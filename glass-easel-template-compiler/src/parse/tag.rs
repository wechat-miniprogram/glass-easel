use std::{borrow::Cow, ops::Range};

use compact_str::CompactString;

use super::{
    binding_map::{BindingMapCollector, BindingMapKeys}, expr::Expression, ParseErrorKind, ParseState, Position, TemplateStructure
};

#[derive(Debug, Clone)]
pub struct Template {
    pub path: String,
    pub content: Vec<Node>,
    pub globals: TemplateGlobals,
    pub binding_map_collector: BindingMapCollector,
}

#[derive(Debug, Clone)]
pub struct TemplateGlobals {
    pub imports: Vec<StrName>,
    pub includes: Vec<StrName>,
    pub sub_templates: Vec<(StrName, Vec<Node>)>,
    pub scripts: Vec<Script>,
}

impl Template {
    pub(super) fn parse(ps: &mut ParseState) -> Self {
        let mut globals = TemplateGlobals {
            imports: vec![],
            includes: vec![],
            sub_templates: vec![],
            scripts: vec![],
        };
        let mut content = vec![];
        Node::parse_vec_node(ps, &mut globals, &mut content);
        let ret = Template {
            path: ps.path.to_string(),
            content: vec![],
            globals,
            binding_map_collector: BindingMapCollector::new(),
        };
        ret
    }
}

#[derive(Debug, Clone)]
pub enum Node {
    Text(Value),
    Element(Element),
    Comment(String, Range<Position>),
    UnknownMetaTag(String, Range<Position>),
}

impl TemplateStructure for Node {
    fn location(&self) -> std::ops::Range<Position> {
        match self {
            Self::Text(x) => x.location(),
            Self::Element(x) => x.location(),
            Self::Comment(_, location) => location.clone(),
            Self::UnknownMetaTag(_, location) => location.clone(),
        }
    }
}

impl Node {
    fn parse_vec_node(ps: &mut ParseState, globals: &mut TemplateGlobals, ret: &mut Vec<Node>) {
        loop {
            if ps.peek_str("</") {
                // tag end, returns
                break;
            }
            if let Some(range) = ps.consume_str("<!") {
                // special tags
                // currently we only support comments
                // report a warning on other cases
                if ps.consume_str("--").is_some() {
                    let s = ps.skip_until_after("-->").unwrap_or("");
                    let location = range.start..ps.position();
                    ret.push(Node::Comment(s.to_string(), location));
                } else {
                    let s = ps.skip_until_after(">").unwrap_or("");
                    let location = range.start..ps.position();
                    ps.add_warning(ParseErrorKind::UnrecognizedTag, location.clone());
                    ret.push(Node::UnknownMetaTag(s.to_string(), location));
                }
                continue;
            }
            if let Some([peek, peek2]) = ps.peek_n() {
                if peek == '<' && Ident::is_start_char(peek2) {
                    Element::parse(ps, globals, ret);
                    continue;
                }
            }
            let value = Value::parse_until_before(ps, |ps| {
                if ps.peek::<0>() != Some('<') { return false; }
                let Some(ch) = ps.peek::<1>() else { return false };
                if ch == '/' || ch == '!' || Ident::is_start_char(ch) { return true; }
                false
            });
            ret.push(Node::Text(value));
        }
    }
}

#[derive(Debug, Clone)]
pub struct Element {
    pub kind: ElementKind,
    pub start_tag_location: (Range<Position>, Range<Position>),
    pub close_location: Range<Position>,
    pub end_tag_location: Option<(Range<Position>, Range<Position>)>,
}

#[derive(Debug, Clone)]
pub enum ElementKind {
    Normal {
        tag_name: Ident,
        attributes: Vec<Attribute>,
        class: ClassAttribute,
        style: StyleAttribute,
        change_attributes: Vec<Attribute>,
        worklet_attributes: Vec<StaticAttribute>,
        event_bindings: Vec<EventBinding>,
        marks: Vec<Attribute>,
        data: Vec<Attribute>,
        children: Vec<Node>,
        generics: Vec<StaticAttribute>,
        extra_attr: Vec<StaticAttribute>,
        slot: Option<(Range<Position>, Value)>,
        slot_value_refs: Vec<StaticAttribute>,
    },
    Pure {
        event_bindings: Vec<EventBinding>,
        marks: Vec<Attribute>,
        children: Vec<Node>,
        slot: Option<(Range<Position>, Value)>,
    },
    For {
        list: (Range<Position>, Value),
        item_name: (Range<Position>, StrName),
        index_name: (Range<Position>, StrName),
        key: (Range<Position>, StrName),
        children: Vec<Node>,
    },
    If {
        branches: Vec<(Range<Position>, Value, Vec<Node>)>,
        else_branch: Option<(Range<Position>, Vec<Node>)>,
    },
    TemplateRef {
        target: (Range<Position>, Value),
        data: (Range<Position>, Value),
        event_bindings: Vec<EventBinding>,
        marks: Vec<Attribute>,
        slot: Option<(Range<Position>, Value)>,
    },
    Include {
        path: (Range<Position>, StrName),
        event_bindings: Vec<EventBinding>,
        marks: Vec<Attribute>,
        slot: Option<(Range<Position>, Value)>,
    },
    Slot {
        event_bindings: Vec<EventBinding>,
        marks: Vec<Attribute>,
        slot: Option<(Range<Position>, Value)>,
        name: (Range<Position>, Value),
        values: Vec<Attribute>,
    },
}

impl TemplateStructure for Element {
    fn location(&self) -> std::ops::Range<Position> {
        match self.end_tag_location.as_ref() {
            None => self.start_tag_location.0.start..self.start_tag_location.1.end,
            Some((_, x)) => self.start_tag_location.0.start..x.end,
        }
    }
}

impl Element {
    pub fn children(&self) -> Option<&Vec<Node>> {
        match &self.kind {
            ElementKind::Normal { children, .. } |
            ElementKind::Pure { children, .. } => {
                Some(children)
            }
            ElementKind::For { .. } |
            ElementKind::If { .. } |
            ElementKind::TemplateRef { .. } |
            ElementKind::Include { .. } |
            ElementKind::Slot { .. } => {
                None
            }
        }
    }

    pub fn children_mut(&mut self) -> Option<&mut Vec<Node>> {
        match &mut self.kind {
            ElementKind::Normal { children, .. } |
            ElementKind::Pure { children, .. } => {
                Some(children)
            }
            ElementKind::For { .. } |
            ElementKind::If { .. } |
            ElementKind::TemplateRef { .. } |
            ElementKind::Include { .. } |
            ElementKind::Slot { .. } => {
                None
            }
        }
    }

    fn parse(ps: &mut ParseState, globals: &mut TemplateGlobals, ret: &mut Vec<Node>) {
        // parse `<xxx`
        let start_tag_start_location = ps.consume_str("<").unwrap();
        let mut tag_name_slices = Ident::parse_colon_separated(ps);
        debug_assert_ne!(tag_name_slices.len(), 0);
        let tag_name = if tag_name_slices.len() > 1 {
            let end = tag_name_slices.pop().unwrap();
            for x in tag_name_slices {
                ps.add_warning(ParseErrorKind::IllegalNamePrefix, x.location());
            }
            Ident {
                name: CompactString::new_inline("wx-x"),
                location: end.location(),
            }
        } else {
            tag_name_slices.pop().unwrap()
        };
        ps.skip_whitespace();

        // create an empty element
        let default_attr_position = tag_name.location.end;
        let tag_name_str = tag_name.name.as_str();
        let is_script_tag = tag_name_str == "wxs";
        let is_import_tag = tag_name_str == "import";
        let mut element = match tag_name_str {
            "block" => {
                ElementKind::Pure {
                    event_bindings: vec![],
                    marks: vec![],
                    children: vec![],
                    slot: None,
                }
            }
            "template" => {
                ElementKind::TemplateRef {
                    target: (default_attr_position..default_attr_position, Value::new_empty(default_attr_position)),
                    data: (default_attr_position..default_attr_position, Value::new_empty(default_attr_position)),
                    event_bindings: vec![],
                    marks: vec![],
                    slot: None,
                }
            }
            "include" | "wxs" | "import" => {
                ElementKind::Include {
                    path: (default_attr_position..default_attr_position, StrName::new_empty(default_attr_position)),
                    event_bindings: vec![],
                    marks: vec![],
                    slot: None,
                }
            }
            "slot" => {
                ElementKind::Slot {
                    event_bindings: vec![],
                    marks: vec![],
                    slot: None,
                    name: (default_attr_position..default_attr_position, Value::new_empty(default_attr_position)),
                    values: vec![],
                }
            }
            _ => {
                ElementKind::Normal {
                    tag_name: tag_name.clone(),
                    attributes: vec![],
                    class: ClassAttribute::None,
                    style: StyleAttribute::None,
                    change_attributes: vec![],
                    worklet_attributes: vec![],
                    event_bindings: vec![],
                    marks: vec![],
                    data: vec![],
                    children: vec![],
                    generics: vec![],
                    extra_attr: vec![],
                    slot: None,
                    slot_value_refs: vec![],
                }
            }
        };

        // parse attributes
        let mut wx_if: Option<(Range<Position>, Value)> = None;
        let mut wx_elif: Option<(Range<Position>, Value)> = None;
        let mut wx_else: Option<Range<Position>> = None;
        let mut wx_for: Option<(Range<Position>, Value)> = None;
        let mut wx_for_index: Option<(Range<Position>, StrName)> = None;
        let mut wx_for_item: Option<(Range<Position>, StrName)> = None;
        let mut wx_key: Option<(Range<Position>, StrName)> = None;
        let mut template_name: Option<(Range<Position>, StrName)> = None;
        let mut script_module: Option<(Range<Position>, StrName)> = None;
        let mut class_attrs: Vec<(Range<Position>, Ident, Value)> = vec![];
        let mut style_attrs: Vec<(Range<Position>, Ident, Value)> = vec![];
        loop {
            let Some(peek) = ps.peek::<0>() else { break };
            if peek == '>' {
                break;
            }
            if peek == '/' {
                // maybe self-close
                if !ps.peek_str("/>") {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                }
            } else if Ident::is_start_char(peek) {
                // decide the attribute kind
                enum AttrPrefixKind {
                    Normal,
                    Slot,
                    WxIf,
                    WxElif,
                    WxElse,
                    WxFor,
                    WxForIndex,
                    WxForItem,
                    WxKey,
                    TemplateName,
                    TemplateIs,
                    TemplateData,
                    Src,
                    Module,
                    SlotName,
                    Model(Range<Position>),
                    Change(Range<Position>),
                    Worklet(Range<Position>),
                    Data(Range<Position>),
                    Class(Range<Position>),
                    Style(Range<Position>),
                    Bind(Range<Position>),
                    MutBind(Range<Position>),
                    Catch(Range<Position>),
                    CaptureBind(Range<Position>),
                    CaptureMutBind(Range<Position>),
                    CaptureCatch(Range<Position>),
                    Mark(Range<Position>),
                    Generic(Range<Position>),
                    ExtraAttr(Range<Position>),
                    SlotDataRef(Range<Position>),
                    Invalid(Range<Position>),
                }
                let mut segs = Ident::parse_colon_separated(ps);
                let attr_name = segs.pop().unwrap();
                let prefix = if segs.len() <= 1 {
                    match segs.first() {
                        None => {
                            match (&element, attr_name.name.as_str()) {
                                (ElementKind::TemplateRef { .. }, "name") => AttrPrefixKind::TemplateName,
                                (ElementKind::TemplateRef { .. }, "is") => AttrPrefixKind::TemplateIs,
                                (ElementKind::TemplateRef { .. }, "data") => AttrPrefixKind::TemplateData,
                                (ElementKind::Include { .. }, "src") => AttrPrefixKind::Src,
                                (ElementKind::Include { .. }, "module") => {
                                    match is_script_tag {
                                        false => AttrPrefixKind::Normal,
                                        true => AttrPrefixKind::Module,
                                    }
                                }
                                (ElementKind::Slot { .. }, "name") => AttrPrefixKind::SlotName,
                                (_, "slot") => AttrPrefixKind::Slot,
                                _ => AttrPrefixKind::Normal,
                            }
                        }
                        Some(x) => match x.name.as_str() {
                            "wx" => match attr_name.name.as_str() {
                                "if" => AttrPrefixKind::WxIf,
                                "elif" => AttrPrefixKind::WxElif,
                                "else" => AttrPrefixKind::WxElse,
                                "for" => AttrPrefixKind::WxFor,
                                "for-index" => AttrPrefixKind::WxForIndex,
                                "for-item" => AttrPrefixKind::WxForItem,
                                "key" => AttrPrefixKind::WxKey,
                                _ => AttrPrefixKind::Invalid(segs.first().unwrap().location())
                            },
                            "model" => AttrPrefixKind::Model(x.location()),
                            "change" => AttrPrefixKind::Change(x.location()),
                            "worklet" => AttrPrefixKind::Worklet(x.location()),
                            "data" => AttrPrefixKind::Data(x.location()),
                            "class" => AttrPrefixKind::Class(x.location()),
                            "style" => AttrPrefixKind::Style(x.location()),
                            "bind" => AttrPrefixKind::Bind(x.location()),
                            "mut-bind" => AttrPrefixKind::MutBind(x.location()),
                            "catch" => AttrPrefixKind::Catch(x.location()),
                            "capture-bind" => AttrPrefixKind::CaptureBind(x.location()),
                            "capture-mut-bind" => AttrPrefixKind::CaptureMutBind(x.location()),
                            "capture-catch" => AttrPrefixKind::CaptureCatch(x.location()),
                            "mark" => AttrPrefixKind::Mark(x.location()),
                            "generic" => AttrPrefixKind::Generic(x.location()),
                            "extra-attr" => AttrPrefixKind::ExtraAttr(x.location()),
                            "slot" => AttrPrefixKind::SlotDataRef(x.location()),
                            _ => AttrPrefixKind::Invalid(x.location()),
                        }
                    }
                } else {
                    AttrPrefixKind::Invalid(segs.first().unwrap().location())
                };
                if let AttrPrefixKind::Invalid(location) = &prefix {
                    ps.add_warning(ParseErrorKind::IllegalAttributePrefix, location.clone());
                }
                #[derive(Debug, PartialEq)]
                enum AttrPrefixParseKind {
                    Value,
                    StaticStr,
                    ScopeName,
                }
                let parse_kind = match prefix {
                    AttrPrefixKind::Normal => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Slot => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxIf => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxElif => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxElse => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::WxFor => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxForIndex => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::WxForItem => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::WxKey => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::TemplateName => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::TemplateIs => AttrPrefixParseKind::Value,
                    AttrPrefixKind::TemplateData => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Src => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::Module => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::SlotName => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Model(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Change(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Worklet(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::Data(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Class(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Style(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Bind(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::MutBind(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Catch(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureBind(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureMutBind(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureCatch(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Mark(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Generic(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::ExtraAttr(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::SlotDataRef(_) => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::Invalid(_) => AttrPrefixParseKind::Value,
                };

                // actually parse the value
                enum AttrPrefixParseResult {
                    Invalid,
                    Value(Value),
                    StaticStr(StrName),
                    ScopeName(StrName),
                }
                let ws_before_eq = ps.skip_whitespace();
                let attr_value = if let Some(eq_range) = ps.consume_str("=") {
                    if let Some(range) = ws_before_eq {
                        ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                    }
                    let ws_after_eq = ps.skip_whitespace();
                    let attr_value = match ps.peek::<0>() {
                        None | Some('>') | Some('/') => {
                            let pos = eq_range.end;
                            ps.add_warning(ParseErrorKind::MissingAttributeValue, eq_range);
                            match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(StrName::new_empty(pos)),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(StrName::new_empty(pos)),
                            }
                        }
                        Some(ch) if ch == '"' || ch == '\'' => {
                            // parse as `"..."`
                            if let Some(range) = ws_after_eq {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            ps.next(); // ch
                            let until = |ps: &mut ParseState| ps.peek::<0>() == Some(ch);
                            let value = match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::parse_until_before(ps, until)),
                                AttrPrefixParseKind::StaticStr => {
                                    let v = StrName::parse_identifier_like_until_before(ps, until);
                                    if v.name.as_str().contains("{{") {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, v.location());
                                    }
                                    AttrPrefixParseResult::StaticStr(v)
                                },
                                AttrPrefixParseKind::ScopeName => {
                                    let v = StrName::parse_identifier_like_until_before(ps, until);
                                    if !v.is_valid_js_identifier() {
                                        ps.add_warning(ParseErrorKind::InvalidIdentifier, v.location());
                                    }
                                    AttrPrefixParseResult::ScopeName(v)
                                },
                            };
                            ps.next(); // ch
                            value
                        }
                        Some('{') if ps.peek_str("{{") => {
                            // parse `{{...}}`
                            if let Some(range) = ws_after_eq {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            let value = Value::parse_data_binding(ps);
                            if let Some(value) = value {
                                match parse_kind {
                                    AttrPrefixParseKind::Value => {
                                        AttrPrefixParseResult::Value(value)
                                    }
                                    AttrPrefixParseKind::StaticStr | AttrPrefixParseKind::ScopeName => {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, value.location());
                                        AttrPrefixParseResult::Invalid
                                    }
                                }
                            } else {
                                AttrPrefixParseResult::Invalid
                            }
                        }
                        Some(_) if ws_after_eq.is_none() => {
                            let v = StrName::parse_identifier_like_until_before(ps, |ps| {
                                match ps.peek::<0>() {
                                    None => true,
                                    Some(ch) => !Ident::is_following_char(ch),
                                }
                            });
                            match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::Static { value: v.name, location: v.location }),
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(v),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(v),
                            }
                        }
                        _ => {
                            let pos = eq_range.end;
                            ps.add_warning(ParseErrorKind::MissingAttributeValue, eq_range);
                            match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(StrName::new_empty(pos)),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(StrName::new_empty(pos)),
                            }
                        }
                    };
                    ps.skip_whitespace();
                    attr_value
                } else {
                    let pos = attr_name.location.end;
                    match parse_kind {
                        AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                        AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(StrName::new_empty(pos)),
                        AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(StrName::new_empty(pos)),
                    }
                };

                // apply attribute value according to its kind
                fn add_element_event_binding(
                    ps: &mut ParseState,
                    element: &mut ElementKind,
                    attr_name: Ident,
                    attr_value: AttrPrefixParseResult,
                    is_catch: bool,
                    is_mut: bool,
                    is_capture: bool,
                    prefix_location: Range<Position>,
                ) {
                    match element {
                        ElementKind::Normal { event_bindings, .. } |
                        ElementKind::Pure { event_bindings, .. } |
                        ElementKind::TemplateRef { event_bindings, .. } |
                        ElementKind::Include { event_bindings, .. } |
                        ElementKind::Slot { event_bindings, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if event_bindings.iter().find(|eb| eb.name.name_eq(&attr_name)).is_some() {
                                    ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                } else {
                                    event_bindings.push(EventBinding {
                                        name: attr_name,
                                        value,
                                        is_catch,
                                        is_mut,
                                        is_capture,
                                        prefix_location,
                                    });
                                }
                            }
                        }
                        ElementKind::For { .. } |
                        ElementKind::If { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    }
                }
                match prefix {
                    AttrPrefixKind::Normal => {
                        match &mut element {
                            ElementKind::Normal { attributes, .. } | ElementKind::Slot { values: attributes, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if attributes.iter().find(|x| x.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        let attr = Attribute { name: attr_name, value, is_model: false, prefix_location: None };
                                        attributes.push(attr);
                                    }
                                }
                            }
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Slot => {
                        match &mut element {
                            ElementKind::Normal { slot, .. } |
                            ElementKind::Pure { slot, .. } |
                            ElementKind::TemplateRef { slot, .. } |
                            ElementKind::Include { slot, .. } |
                            ElementKind::Slot { slot, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if slot.is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *slot = Some((attr_name.location(), value));
                                    }
                                }
                            }
                            ElementKind::For { .. } |
                            ElementKind::If { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::WxIf => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_if.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_if = Some((attr_name.location(), value));
                            }
                        }
                    }
                    AttrPrefixKind::WxElif => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_elif.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_elif = Some((attr_name.location(), value));
                            }
                        }
                    }
                    AttrPrefixKind::WxElse => {
                        if let AttrPrefixParseResult::StaticStr(value) = attr_value {
                            if wx_elif.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location());
                            } else {
                                if value.name.len() > 0 {
                                    ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location());
                                }
                                wx_else = Some(attr_name.location());
                            }
                        }
                    }
                    AttrPrefixKind::WxFor => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_for.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for = Some((attr_name.location(), value));
                            }
                        }
                    }
                    AttrPrefixKind::WxForIndex => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_index.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for_index = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::WxForItem => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_item.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for_item = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::WxKey => {
                        if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                            if wx_key.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_key = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::TemplateName => {
                        if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                            if template_name.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                template_name = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::TemplateIs => {
                        match &mut element {
                            ElementKind::TemplateRef { target, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if target.1.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *target = (attr_name.location(), value);
                                    }
                                }
                            }
                            _ => unreachable!(),
                        }
                    }
                    AttrPrefixKind::TemplateData => {
                        match &mut element {
                            ElementKind::TemplateRef { data, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if data.1.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *data = (attr_name.location(), value);
                                    }
                                }
                            }
                            _ => unreachable!(),
                        }
                    }
                    AttrPrefixKind::Src => {
                        match &mut element {
                            ElementKind::Include { path, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if path.1.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *path = (attr_name.location(), s);
                                    }
                                }
                            }
                            _ => unreachable!(),
                        }
                    }
                    AttrPrefixKind::Module => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_item.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                script_module = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::SlotName => {
                        match &mut element {
                            ElementKind::Slot { name, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if name.1.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *name = (attr_name.location(), value);
                                    }
                                }
                            }
                            _ => unreachable!(),
                        }
                    }
                    AttrPrefixKind::Model(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { attributes, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if attributes.iter().find(|x| x.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        let attr = Attribute { name: attr_name, value, is_model: true, prefix_location: Some(prefix_location) };
                                        attributes.push(attr);
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Change(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { change_attributes, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if change_attributes.iter().find(|x| x.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        change_attributes.push(Attribute {
                                            name: attr_name,
                                            value,
                                            is_model: false,
                                            prefix_location: Some(prefix_location),
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Worklet(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { worklet_attributes, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if worklet_attributes.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        worklet_attributes.push(StaticAttribute {
                                            name: attr_name,
                                            value: s,
                                            prefix_location,
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Data(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { data, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if data.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        data.push(Attribute {
                                            name: attr_name,
                                            value,
                                            is_model: false,
                                            prefix_location: Some(prefix_location),
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Class(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if class_attrs.iter().find(|(_, x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        class_attrs.push((prefix_location, attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Style(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if class_attrs.iter().find(|(_, x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        style_attrs.push((prefix_location, attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Bind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, false, false, prefix_location);
                    }
                    AttrPrefixKind::MutBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, true, false, prefix_location);
                    }
                    AttrPrefixKind::Catch(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, true, false, false, prefix_location);
                    }
                    AttrPrefixKind::CaptureBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, false, true, prefix_location);
                    }
                    AttrPrefixKind::CaptureMutBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, true, true, prefix_location);
                    }
                    AttrPrefixKind::CaptureCatch(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, true, false, true, prefix_location);
                    }
                    AttrPrefixKind::Mark(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { marks, .. } |
                            ElementKind::Pure { marks, .. } |
                            ElementKind::TemplateRef { marks, .. } |
                            ElementKind::Include { marks, .. } |
                            ElementKind::Slot { marks, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if marks.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        marks.push(Attribute {
                                            name: attr_name,
                                            value,
                                            is_model: false,
                                            prefix_location: Some(prefix_location),
                                        });
                                    }
                                }
                            }
                            ElementKind::For { .. } |
                            ElementKind::If { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Generic(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { generics, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if generics.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        generics.push(StaticAttribute {
                                            name: attr_name,
                                            value: s,
                                            prefix_location,
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::ExtraAttr(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { extra_attr, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if extra_attr.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        extra_attr.push(StaticAttribute {
                                            name: attr_name,
                                            value: s,
                                            prefix_location,
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::SlotDataRef(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { slot_value_refs, .. } => {
                                if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                                    if slot_value_refs.iter().find(|attr| attr.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        slot_value_refs.push(StaticAttribute {
                                            name: attr_name,
                                            value: s,
                                            prefix_location,
                                        });
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Invalid(_) => {}
                }
            } else {
                let pos = ps.position();
                loop {
                    let Some(peek) = ps.peek::<0>() else { break };
                    if peek == '/' || peek == '>' || Ident::is_start_char(peek) || char::is_whitespace(peek) {
                        break
                    }
                }
                ps.add_warning(ParseErrorKind::IllegalAttributeName, pos..ps.position());
                ps.skip_whitespace();
            }
        }

        // end the start tag
        let (self_close_location, start_tag_end_location) = match ps.peek::<0>() {
            None => {
                ps.add_warning(ParseErrorKind::IncompleteTag, start_tag_start_location.clone());
                let pos = ps.position();
                (Some(pos..pos), pos..pos)
            }
            Some('/') => {
                let close_location = ps.consume_str("/").unwrap();
                let start_tag_end_location = ps.consume_str(">").unwrap();
                (Some(close_location), start_tag_end_location)
            }
            Some('>') => {
                (None, ps.consume_str(">").unwrap())
            }
            _ => unreachable!()
        };

        // validate class & style attributes
        // TODO support `class:xxx` and `style:xxx`

        // check `<template name>` and validate `<template is data>`
        if let ElementKind::TemplateRef { target, data, event_bindings, marks, slot } = &element {
            if template_name.is_some() {
                if target.1.location().end != default_attr_position {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, target.0.clone());
                }
                if data.1.location().end != default_attr_position {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, target.0.clone());
                }
                for x in event_bindings {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, x.name.location());
                }
                for attr in marks {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, attr.name.location());
                }
                if let Some((x, _)) = slot {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, x.clone());
                }
            } else {
                if target.1.location().end == default_attr_position {
                    ps.add_warning(ParseErrorKind::MissingModuleName, target.0.clone());
                }
            }
        };
        let allow_for_if = template_name.is_none() && !is_script_tag && !is_import_tag;

        // check script/import tag
        if is_script_tag || is_import_tag {
            let ElementKind::Include { path: _, event_bindings, marks, slot } = &element else {
                unreachable!();
            };
            for x in event_bindings {
                ps.add_warning(ParseErrorKind::InvalidAttribute, x.name.location());
            }
            for attr in marks {
                ps.add_warning(ParseErrorKind::InvalidAttribute, attr.name.location());
            }
            if let Some((x, _)) = slot {
                ps.add_warning(ParseErrorKind::InvalidAttribute, x.clone());
            }
        }

        let new_children = if is_script_tag || is_import_tag {
            // parse script tag content
            let ElementKind::Include { path, .. } = &element else {
                unreachable!();
            };
            let pos = ps.position();
            let cur_index = ps.cur_index();
            loop {
                ps.skip_until_before("</wxs");
                match ps.peek::<5>() {
                    None => break,
                    Some(ch) if !Ident::is_following_char(ch) => break,
                    _ => {}
                }
                ps.skip_bytes(5);
            }
            let content = ps.code_slice(cur_index..ps.cur_index()).to_string();
            let content_location = pos..ps.position();
            if let Some((_, module_name)) = script_module {
                if path.1.name.is_empty() {
                    globals.scripts.push(Script::Inline { module_name, content, content_location })
                } else {
                    if content.trim().len() > 0 {
                        ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, content_location);
                    }
                    globals.scripts.push(Script::GlobalRef { module_name, path: path.1.clone() })
                }
            } else {
                ps.add_warning(ParseErrorKind::MissingModuleName, tag_name.location());
            }
            vec![]
        } else {
            // parse children
            if self_close_location.is_none() {
                let mut new_children = vec![];
                Node::parse_vec_node(ps, globals, &mut new_children);
                new_children
            } else {
                vec![]
            }
        };

        // parse end tag
        let (close_location, end_tag_location) = if let Some(close_location) = self_close_location {
            (close_location, None)
        } else {
            let close_with_end_tag_location = ps.try_parse(|ps| {
                ps.skip_whitespace();
                if ps.ended() {
                    ps.add_warning(ParseErrorKind::MissingEndTag, start_tag_start_location.clone());
                    return None;
                }
                let end_tag_start_location = ps.consume_str("<").unwrap();
                let close_location = ps.consume_str("/").unwrap();
                let mut tag_name_slices = Ident::parse_colon_separated(ps);
                let end_tag_name = if tag_name_slices.len() > 1 {
                    let end = tag_name_slices.pop().unwrap();
                    for x in tag_name_slices {
                        ps.add_warning(ParseErrorKind::IllegalNamePrefix, x.location());
                    }
                    Ident {
                        name: CompactString::new_inline("wx-x"),
                        location: end.location(),
                    }
                } else {
                    tag_name_slices.pop().unwrap()
                };
                if end_tag_name.name != tag_name.name {
                    return None;
                }
                ps.skip_whitespace();
                let end_tag_end_pos = ps.position();
                if let Some(_) = ps.skip_until_after(">") {
                    ps.add_warning(ParseErrorKind::UnexpectedCharacter, end_tag_end_pos..ps.position());
                }
                let end_tag_location = (end_tag_start_location, end_tag_end_pos..ps.position());
                Some((close_location, end_tag_location))
            });
            if close_with_end_tag_location.is_none() {
                ps.add_warning(ParseErrorKind::MissingEndTag, tag_name.location());
            }
            let close_location = close_with_end_tag_location
                .as_ref()
                .map(|(x, _)| x.clone())
                .unwrap_or_else(|| start_tag_end_location.clone());
            let end_tag_location = close_with_end_tag_location.map(|(_, x)| x);
            (close_location, end_tag_location)
        };

        // collect include and import sources
        if !is_script_tag {
            match &element {
                ElementKind::Include { path, .. } => {
                    if path.1.name.is_empty() {
                        ps.add_warning(ParseErrorKind::MissingSourcePath, tag_name.location());
                    } else {
                        let list = if is_import_tag { &mut globals.imports } else { &mut globals.includes };
                        list.push(path.1.clone());
                    }
                }
                _ => {}
            }
        }

        // extract `wx:for`
        enum ForList {
            None,
            For {
                list: (Range<Position>, Value),
                item_name: (Range<Position>, StrName),
                index_name: (Range<Position>, StrName),
                key: (Range<Position>, StrName),
            },
        }
        let for_list = if !allow_for_if || wx_for.is_none() {
            if let Some((location, _)) = wx_for {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some((location, _)) = wx_for_item {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some((location, _)) = wx_for_index {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some((location, _)) = wx_key {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            ForList::None
        } else {
            let (for_location, for_value) = wx_for.unwrap();
            let item_name = wx_for_item.unwrap_or_else(|| (for_location.clone(), StrName::new_empty(for_location.end.clone())));
            let index_name = wx_for_index.unwrap_or_else(|| (for_location.clone(), StrName::new_empty(for_location.end.clone())));
            let key = wx_key.unwrap_or_else(|| (for_location.clone(), StrName::new_empty(for_location.end.clone())));
            ForList::For {
                list: (for_location, for_value),
                item_name,
                index_name,
                key,
            }
        };

        // extract if conditions
        enum IfCondition {
            None,
            If(Range<Position>, Value),
            Elif(Range<Position>, Value),
            Else(Range<Position>),
        }
        let if_condition = if !allow_for_if {
            if let Some((location, _)) = wx_if {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some((location, _)) = wx_elif {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some(location) = wx_else {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            IfCondition::None
        } else if let ForList::For { .. } = &for_list {
            if let Some((location, _)) = wx_elif {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some(location) = wx_else {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some((location, value)) = wx_if {
                IfCondition::If(location, value)
            } else {
                IfCondition::None
            }
        } else if let Some((location, value)) = wx_if {
            if let Some((location, _)) = wx_elif {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            if let Some(location) = wx_else {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            IfCondition::If(location, value)
        } else if let Some((location, value)) = wx_elif {
            if let Some(location) = wx_else {
                ps.add_warning(ParseErrorKind::InvalidAttribute, location);
            }
            IfCondition::Elif(location, value)
        } else if let Some(location) = wx_else {
            IfCondition::Else(location)
        } else {
            IfCondition::None
        };

        // write the parsed element
        if is_script_tag {
            // empty
        } else if is_import_tag {
            if let Some(child) = new_children.first() {
                ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, child.location());
            }
        } else if let Some((_, name)) = template_name {
            if globals.sub_templates.iter().find(|(x, _)| x.name_eq(&name)).is_some() {
                ps.add_warning(ParseErrorKind::DuplicatedName, name.location());
            } else {
                globals.sub_templates.push((name, new_children));
            }
        } else {
            let wrap_children = |mut element: Element| -> Vec<Node> {
                match &mut element.kind {
                    ElementKind::Pure { event_bindings, marks, slot, children } => {
                        if !event_bindings.is_empty() || !marks.is_empty() || slot.is_some() {
                            // empty
                        } else {
                            return std::mem::replace(children, vec![]);
                        }
                    }
                    _ => {}
                }
                vec![Node::Element(element)]
            };

            // generate normal element
            let wrapped_element = {
                let mut element = Element {
                    kind: element,
                    start_tag_location: (start_tag_start_location.clone(), start_tag_end_location.clone()),
                    close_location: close_location.clone(),
                    end_tag_location: end_tag_location.clone(),
                };
                if let Some(v) = element.children_mut() {
                    *v = new_children;
                } else {
                    if let Some(child) = new_children.first() {
                        ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, child.location());
                    }
                }
                element
            };

            // wrap if condition
            let wrapped_element = match if_condition {
                IfCondition::None => Some(wrapped_element),
                IfCondition::If(location, value) => {
                    let branch = (location, value, wrap_children(wrapped_element));
                    let elem = Element {
                        kind: ElementKind::If { branches: vec![branch], else_branch: None },
                        start_tag_location: (start_tag_start_location.clone(), start_tag_end_location.clone()),
                        close_location: close_location.clone(),
                        end_tag_location: end_tag_location.clone(),
                    };
                    Some(elem)
                }
                IfCondition::Elif(location, value) => {
                    if let Some(Node::Element(Element { kind: ElementKind::If { branches, .. }, .. })) = ret.last_mut() {
                        let branch = (location, value, wrap_children(wrapped_element));
                        branches.push(branch);
                        None
                    } else {
                        ps.add_warning(ParseErrorKind::InvalidAttribute, location);
                        Some(wrapped_element)
                    }
                }
                IfCondition::Else(location) => {
                    if let Some(Node::Element(Element { kind: ElementKind::If { else_branch, .. }, .. })) = ret.last_mut() {
                        let branch = (location, wrap_children(wrapped_element));
                        *else_branch = Some(branch);
                        None
                    } else {
                        ps.add_warning(ParseErrorKind::InvalidAttribute, location);
                        Some(wrapped_element)
                    }
                }
            };

            // wrap for list
            let wrapped_element = match for_list {
                ForList::None => wrapped_element,
                ForList::For { list, item_name, index_name, key } => {
                    let children = wrap_children(wrapped_element.unwrap());
                    let elem = Element {
                        kind: ElementKind::For { list, item_name, index_name, key, children },
                        start_tag_location: (start_tag_start_location.clone(), start_tag_end_location.clone()),
                        close_location: close_location.clone(),
                        end_tag_location: end_tag_location.clone(),
                    };
                    Some(elem)
                }
            };

            // end element
            if let Some(wrapped_element) = wrapped_element {
                ret.push(Node::Element(wrapped_element));
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct Attribute {
    pub name: Ident,
    pub value: Value,
    pub is_model: bool,
    pub prefix_location: Option<Range<Position>>,
}

#[derive(Debug, Clone)]
pub struct StaticAttribute {
    pub name: Ident,
    pub value: StrName,
    pub prefix_location: Range<Position>,
}

#[derive(Debug, Clone)]
pub enum ClassAttribute {
    None,
    String(Range<Position>, Value),
    Multiple(Vec<(Ident, Value)>),
}

#[derive(Debug, Clone)]
pub enum StyleAttribute {
    None,
    String(Range<Position>, Value),
    Multiple(Vec<(Ident, Value)>),
}

#[derive(Debug, Clone)]
pub struct EventBinding {
    pub name: Ident,
    pub value: Value,
    pub is_catch: bool,
    pub is_mut: bool,
    pub is_capture: bool,
    pub prefix_location: Range<Position>,
}

#[derive(Debug, Clone)]
pub struct Ident {
    pub name: CompactString,
    pub location: Range<Position>,
}

impl TemplateStructure for Ident {
    fn location(&self) -> Range<Position> {
        self.location.clone()
    }
}

impl Ident {
    fn is_start_char(ch: char) -> bool {
        ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ch == '_' || ch == ':'
    }

    fn is_following_char(ch: char) -> bool {
        Self::is_start_char(ch) || ('0'..='9').contains(&ch) || ch == '-' || ch == '.'
    }

    fn is_js_start_char(ch: char) -> bool {
        ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ch == '_' || ch == '$'
    }

    fn is_js_following_char(ch: char) -> bool {
        Self::is_start_char(ch) || ('0'..='9').contains(&ch)
    }

    fn name_eq(&self, other: &Self) -> bool {
        self.name == other.name
    }

    fn parse_colon_separated(ps: &mut ParseState) -> Vec<Self> {
        let Some(peek) = ps.peek::<0>() else {
            return vec![];
        };
        if !Self::is_start_char(peek) {
            return vec![];
        }
        let mut ret = Vec::with_capacity(2);
        let pos = ps.position();
        let mut cur_name = Self {
            name: CompactString::new_inline(""),
            location: pos..pos,
        };
        loop {
            match ps.next().unwrap() {
                ':' => {
                    let prev = std::mem::replace(&mut cur_name, Self {
                        name: CompactString::new_inline(""),
                        location: pos..pos,
                    });
                    ret.push(prev);
                }
                ch => {
                    cur_name.name.push(ch);
                    cur_name.location.end = ps.position();
                }
            }
            let Some(peek) = ps.peek::<0>() else { break };
            if !Self::is_following_char(peek) { break };
        }
        ret
    }
}

#[derive(Debug, Clone)]
pub struct StrName {
    pub name: CompactString,
    pub location: Range<Position>,
}

impl TemplateStructure for StrName {
    fn location(&self) -> Range<Position> {
        self.location.clone()
    }
}

impl StrName {
    fn name_eq(&self, other: &Self) -> bool {
        self.name == other.name
    }

    fn new_empty(pos: Position) -> Self {
        Self {
            name: CompactString::new_inline(""),
            location: pos..pos,
        }
    }

    fn parse_next_entity<'s>(ps: &mut ParseState<'s>) -> Cow<'s, str> {
        if ps.peek_str("&") {
            let s = ps.try_parse(|ps| {
                let start = ps.cur_index();
                let start_pos = ps.position();
                ps.next(); // '&'
                let next = ps.next()?;
                if next == '#' {
                    let next = ps.next()?;
                    if next == 'x' {
                        // parse `&#x...;`
                        loop {
                            let Some(next) = ps.next() else {
                                ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                                return None;
                            };
                            match next {
                                ';' => break,
                                '0'..='9' | 'a'..='f' | 'A'..='F' => {}
                                _ => {
                                    ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                                    return None;
                                }
                            }
                        }
                    } else if ('0'..='9').contains(&next) {
                        // parse `&#...;`
                        loop {
                            let Some(next) = ps.next() else {
                                ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                                return None;
                            };
                            match next {
                                ';' => break,
                                '0'..='9' => {}
                                _ => {
                                    ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                                    return None;
                                }
                            }
                        }
                    } else {
                        ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                        return None;
                    }
                } else if ('a'..='z').contains(&next) || ('A'..='Z').contains(&next) {
                    // parse `&...;`
                    loop {
                        let next = ps.next()?;
                        match next {
                            ';' => break,
                            'a'..='z' | 'A'..='Z' => {}
                            _ => {
                                return None;
                            }
                        }
                    }
                } else {
                    return None;
                }
                let ret = crate::entities::decode(ps.code_slice(start..ps.cur_index()));
                if ret.is_none() {
                    ps.add_warning(ParseErrorKind::IllegalEntity, start_pos..ps.position());
                }
                ret
            });
            if let Some(s) = s {
                return s;
            }
        }
        Cow::Borrowed(ps.next_char_as_str())
    }

    fn parse_identifier_like_until_before(ps: &mut ParseState, until: impl Fn(&mut ParseState) -> bool) -> Self {
        let mut name = CompactString::new_inline("");
        let start_pos = ps.position();
        loop {
            if ps.ended() || until(ps) {
                break
            }
            name.push_str(&StrName::parse_next_entity(ps));
        }
        Self {
            name,
            location: start_pos..ps.position(),
        }
    }

    fn is_valid_js_identifier(&self) -> bool {
        let mut chars = self.name.chars();
        let first = chars.next();
        match first {
            None => false,
            Some(ch) if !Ident::is_js_start_char(ch) => false,
            Some(_) => {
                chars.find(|ch| !Ident::is_js_following_char(*ch)).is_none()
            }
        }
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    Static {
        value: CompactString,
        location: Range<Position>,
    },
    Dynamic {
        expression: Box<Expression>,
        double_brace_location: (Range<Position>, Range<Position>),
        binding_map_keys: Option<BindingMapKeys>,
    },
}

impl TemplateStructure for Value {
    fn location(&self) -> Range<Position> {
        match self {
            Self::Static { value: _, location } => location.clone(),
            Self::Dynamic { expression: _, double_brace_location, binding_map_keys: _ } => {
                double_brace_location.0.start..double_brace_location.1.end
            },
        }
    }
}

impl Value {
    fn new_empty(pos: Position) -> Self {
        Self::Static { value: CompactString::new_inline(""), location: pos..pos }
    }

    pub fn is_empty(&self) -> bool {
        if let Self::Static { value, .. } = self {
            value.is_empty()
        } else {
            false
        }
    }

    fn parse_data_binding(ps: &mut ParseState) -> Option<Self> {
        let Some(double_brace_left) = ps.consume_str("{{") else {
            return None;
        };
        let Some(expression) = Expression::parse_expression_or_object_inner(ps) else {
            ps.skip_until_after("}}");
            return Some(Self::Static { value: CompactString::new_inline(""), location: double_brace_left.start..ps.position() });
        };
        ps.skip_whitespace();
        let end_pos = ps.position();
        match ps.skip_until_before("}}") {
            None => {
                ps.add_warning_at_current_position(ParseErrorKind::MissingExpressionEnd);
            }
            Some(s) => {
                if s.len() > 0 {
                    ps.add_warning(ParseErrorKind::IllegalExpression, end_pos..ps.position());
                }
            }
        };
        let double_brace_right = ps.consume_str("}}").unwrap_or_else(|| {
            let pos = ps.position();
            pos..pos
        });
        Some(Self::Dynamic {
            expression,
            double_brace_location: (double_brace_left, double_brace_right),
            binding_map_keys: None,
        })
    }

    fn parse_until_before(ps: &mut ParseState, until: impl Fn(&mut ParseState) -> bool) -> Self {
        let mut ret = Self::Static {
            value: CompactString::new_inline(""),
            location: {
                let start_pos = ps.position();
                start_pos..start_pos
            },
        };
        fn has_wrapped_to_string(expr: &Expression) -> bool {
            match expr {
                Expression::ToStringWithoutUndefined { .. } => true,
                _ => false,
            }
        }
        fn wrap_to_string(expr: Box<Expression>, location: Range<Position>) -> Box<Expression> {
            if has_wrapped_to_string(&expr) { return expr; }
            Box::new(Expression::ToStringWithoutUndefined { value: expr, location })
        }
        loop {
            if until(ps) { break };
            let Some(peek) = ps.peek::<0>() else { break };
            let start_pos = ps.position();

            // try parse `{{ ... }}`
            if peek == '{' {
                match ps.try_parse(Self::parse_data_binding) {
                    Some(Value::Dynamic { expression, double_brace_location, binding_map_keys: _ }) => {
                        let expression = match ret {
                            Self::Static { value, location } => {
                                if value.is_empty() {
                                    expression
                                } else {
                                    let left = Box::new(Expression::LitStr { value, location });
                                    let right = wrap_to_string(expression, double_brace_location.1.clone());
                                    Box::new(Expression::Plus { left, right, location: double_brace_location.0.clone() })
                                }
                            }
                            Self::Dynamic { expression: left, double_brace_location: left_double_brace_location, binding_map_keys: _ } => {
                                let left = wrap_to_string(left, left_double_brace_location.1.clone());
                                let right = wrap_to_string(expression, double_brace_location.1.clone());
                                Box::new(Expression::Plus { left, right, location: double_brace_location.0.clone() })
                            }
                        };
                        let left = expression.location_start();
                        let right = expression.location_end();
                        ret = Self::Dynamic { expression, double_brace_location: (left..left, right..right), binding_map_keys: None };
                        continue;
                    }
                    Some(Value::Static { .. }) => {
                        continue;
                    }
                    None => {}
                }
            }

            // convert `Self` format if needed
            ret = if let Self::Dynamic { expression, double_brace_location, binding_map_keys } = ret {
                let need_convert = if let Expression::Plus { right, .. } = &*expression {
                    if let Expression::LitStr { .. } = &**right {
                        false
                    } else {
                        true
                    }
                } else {
                    true
                };
                if need_convert {
                    let left = wrap_to_string(expression, double_brace_location.1.clone());
                    let right = Box::new(Expression::LitStr { value: CompactString::new_inline(""), location: start_pos..start_pos });
                    let expression = Box::new(Expression::Plus { left, right, location: double_brace_location.0.clone() });
                    Self::Dynamic { expression, double_brace_location, binding_map_keys }
                } else {
                    Self::Dynamic { expression, double_brace_location, binding_map_keys }
                }
            } else {
                ret
            };
            let (ret_value, ret_location) = match &mut ret {
                Self::Static { value, location } => (value, location),
                Self::Dynamic { expression, .. } => {
                    if let Expression::Plus { right, .. } = &mut **expression {
                        if let Expression::LitStr { value, location } = &mut **right {
                            (value, location)
                        } else {
                            unreachable!()
                        }
                    } else {
                        unreachable!()
                    }
                }
            };

            // parse next char
            ret_value.push_str(&StrName::parse_next_entity(ps));
            ret_location.end = ps.position();
        }
        ret
    }
}

#[derive(Debug, Clone)]
pub enum Script {
    Inline {
        module_name: StrName,
        content: String,
        content_location: Range<Position>,
    },
    GlobalRef {
        module_name: StrName,
        path: StrName,
    },
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn value_parsing() {
        case!("{ {", r#"{ {"#);
        case!("{{ a } }", "", ParseErrorKind::MissingExpressionEnd, 8..8);
        case!("{{ a b }}", "", ParseErrorKind::IllegalExpression, 5..7);
        case!(" a\t{{ b }}", r#"{{"a\t"+b}}"#);
        case!("{{ b }} a ", r#"{{b+' a '}}"#);
        case!("{{ a }}{{ b }}", r#"{{a+b}}"#);
    }

    #[test]
    fn entities_parsing() {
        case!("&#xG;", r#"&#xG;"#, ParseErrorKind::IllegalEntity, 0..4);
        case!("&#x ", r#"&#x "#, ParseErrorKind::IllegalEntity, 0..3);
        case!("&#x41;", r#"A"#);
        case!("&#A;", r#"&#a;"#, ParseErrorKind::IllegalEntity, 0..3);
        case!("&# ", r#"&# "#, ParseErrorKind::IllegalEntity, 0..2);
        case!("&#97;", r#"a"#);
        case!("&lt", r#"&lt"#);
        case!("&lt ", r#"&lt "#);
        case!("&lt;", r#"<"#);
    }

    #[test]
    fn tag_structure() {
        case!("<", r#"<"#);
        case!("<-", r#"<-"#);
        case!("<div", r#"<div></div>"#, ParseErrorKind::IncompleteTag, 4..4);
        case!("<div ", r#"<div></div>"#, ParseErrorKind::IncompleteTag, 5..5);
        case!("<div>", r#"<div></div>"#, ParseErrorKind::MissingEndTag, 5..5);
        case!("<div><span></div>", r#"<div><span></span></div>"#, ParseErrorKind::MissingEndTag, 11..11);
        case!("<div><span></span>", r#"<div><span></span></div>"#, ParseErrorKind::MissingEndTag, 18..18);
        case!("<div >", r#"<div></div>"#, ParseErrorKind::MissingEndTag, 6..6);
        case!("<a:div/>", r#"<wx-x></wx-x>"#, ParseErrorKind::IllegalNamePrefix, 1..2);
        case!("<div/ ></div>", r#"<div></div>"#, ParseErrorKind::UnexpectedCharacter, 4..5);
        case!("<div a:mark:c/>", r#"<div></div>"#, ParseErrorKind::IllegalNamePrefix, 5..6);
        case!("<div marks:c/>", r#"<div></div>"#, ParseErrorKind::IllegalNamePrefix, 5..10);
        case!("<div marks:/>", r#"<div></div>"#, ParseErrorKind::InvalidAttribute, 5..10);
        case!("<div a =''/>", r#"<div a=""></div>"#, ParseErrorKind::UnexpectedWhitespace, 6..7);
        case!("<div a= ''/>", r#"<div a=""></div>"#, ParseErrorKind::UnexpectedWhitespace, 7..8);
        case!("<div a= {{b}}/>", r#"<div a="{{b}}"></div>"#, ParseErrorKind::UnexpectedWhitespace, 7..8);
        case!("<div a= b/>", r#"<div a b></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
        case!("<div a=>", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
        case!("<div a=/>", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
        case!("<div a=", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
        case!("<div #@></div>", r#"<div></div>"#, ParseErrorKind::IllegalAttributeName, 5..7);
        case!("<div a a></div>", r#"<div></div>"#, ParseErrorKind::DuplicatedAttribute, 7..8);
        case!("<div></div  a=''>", r#"<div></div>"#, ParseErrorKind::UnexpectedCharacter, 12..16);
    }

    #[test]
    fn normal_element() {
        case!("<div a='1'></div>", r#"<div a="1"></div>"#);
        case!("<div change:a='fn'></div>", r#"<div change:a="fn"></div>"#);
        case!("<div worklet:a='fn'></div>", r#"<div worklet:a="fn"></div>"#);
        case!("<div worklet:a='{{ a }}'></div>", r#"<div worklet:a="{{ a }}"></div>"#, ParseErrorKind::DataBindingNotAllowed, 16..23);
        case!("<div mark:aB='fn'></div>", r#"<div mark:aB="fn"></div>"#);
        case!("<div data:aB='fn'></div>", r#"<div data:aB="fn"></div>"#);
        case!("<div data-a-bC='fn'></div>", r#"<div data:aBc="fn"></div>"#);
        case!("<div generic:a='A'></div>", r#"<div generic:a="A"></div>"#);
        case!("<div generic:a='{{ A }}'></div>", r#"<div generic:a="{{ A }}"></div>"#, ParseErrorKind::DataBindingNotAllowed, 16..23);
        case!("<div extra-attr:a='A'></div>", r#"<div extra-attr:a="A"></div>"#);
        case!("<div extra-attr:a='{{ A }}'></div>", r#"<div extra-attr:a="{{ A }}"></div>"#, ParseErrorKind::DataBindingNotAllowed, 19..26);
        case!("<div slot='a'></div>", r#"<div slot="a"></div>"#);
        case!("<div slot='{{ a }}'></div>", r#"<div slot="{{ a }}"></div>"#, ParseErrorKind::DataBindingNotAllowed, 11..18);
        case!("<div slot:a></div>", r#"<div slot:a></div>"#);
        case!("<div slot:a='A'></div>", r#"<div slot:a="A"></div>"#);
        case!("<div slot:a='A '></div>", r#"<div slot:a="A "></div>"#, ParseErrorKind::InvalidIdentifier, 13..15);
    }

    #[test]
    fn pure_block() {
        case!("<block> abc </block>", " abc ");
        case!("<block a=''></block>", r#"<block></block>"#, ParseErrorKind::InvalidAttribute, 7..8);
        case!("<div mark:aB='fn'></div>", r#"<div mark:aB="fn"></div>"#);
        case!("<div slot='a'></div>", r#"<div slot='a'></div>"#);
    }

    #[test]
    fn for_list() {
        case!("<block wx:for='{{ a }}'> abc </block>", r#"<block wx:for="{{a}}"> abc </block>"#);
        case!("<div wx:for='{{ a }}'> a </div>", r#"<block wx:for="{{a}}"><div> a </div></block>"#);
        case!("<block wx:for='{{ a }}' wx:for-index='i' wx:for-item='j' wx:key='t'></block>", r#"<block wx:for="{{a}}" wx:for-index='i' wx:for-item="j" wx:key="t"></block>"#);
        case!("<block wx:for='{{ a }}' wx:for-index='i '></block>", r#"<block wx:for="{{a}}" wx:for-index='i '></block>"#, ParseErrorKind::InvalidIdentifier, 38..40);
        case!("<block wx:for='{{ a }}' wx:for-item='i '></block>", r#"<block wx:for="{{a}}" wx:for-item='i '></block>"#, ParseErrorKind::InvalidIdentifier, 37..39);
        case!("<block wx:for='{{ a }}' wx:key='i '></block>", r#"<block wx:for="{{a}}" wx:key='i '></block>"#, ParseErrorKind::InvalidIdentifier, 32..34);
        case!("<block wx:for='{{ a }}' wx:key='i '></block>", r#"<block wx:for="{{a}}" wx:key='i '></block>"#, ParseErrorKind::InvalidIdentifier, 32..34);
    }

    #[test]
    fn if_group() {
        case!("<block wx:if='{{a}}'> abc </block>", r#"<block wx:if='{{a}}'> abc </block>"#);
        case!("<block wx:if='{{a}}'> abc </block><div wx:else/>", r#"<block wx:if='{{a}}'> abc </block><block wx:else><div></div></block>"#);
        case!("<block wx:if='{{a}}'> abc </block><div wx:elif='{{ b }}'/>", r#"<block wx:if='{{a}}'> abc </block><block wx:elif='{{b}}'><div></div></block>"#);
        case!("<block wx:if='{{a}}'> abc </block><div wx:elif='{{ b }}'/><block wx:else>A</block>", r#"<block wx:if='{{a}}'> abc </block><block wx:elif='{{b}}'><div></div></block><block wx:else>A</block>"#);
        case!("<block wx:elif='{{a}}'> abc </block>", r#" abc "#, ParseErrorKind::IllegalAttributeValue, 10..14);
        case!("<block wx:else> abc </block>", r#" abc "#, ParseErrorKind::IllegalAttributeValue, 10..14);
        case!("<block wx:if=''/><block wx:else=' '/>", r#"<block wx:if=""></block><block wx:else></block>"#, ParseErrorKind::IllegalAttributeValue, 33..34);
        case!("<block wx:if=''/><div wx:for='' wx:else />", r#"<block wx:if=""/><div wx:for=""/>"#, ParseErrorKind::InvalidAttribute, 35..39);
        case!("<block wx:if=''/><include src='a' wx:else />", r#"<block wx:if=""/><include src='a'/>"#, ParseErrorKind::InvalidAttribute, 37..41);
    }

    #[test]
    fn template() {
        case!("<template />", r#"<template is=""></template>"#, ParseErrorKind::MissingModuleName, 1..9);
        case!("<template a='' is='a' />", r#"<template is="a"></template>"#, ParseErrorKind::InvalidAttribute, 10..11);
        case!("<template is='a' data='{{ ...a }}' /><template name='a'> abc </template>", r#"<template name="a"> abc </template><template is="a" data="{{ ...a }}"></template>"#);
        case!("<template name='a' is='a' />", r#"<template name="a"></template>"#, ParseErrorKind::DuplicatedName, 19..21);
        case!("<template name='a' data='{{ ...a }}' />", r#"<template name="a"></template>"#, ParseErrorKind::DuplicatedName, 19..23);
        case!("<template name='a'/><template name='a'/>", r#"<template name="a"></template>"#, ParseErrorKind::DuplicatedName, 36..37);
        case!("<template name='a' wx:for='' />", r#"<template name="a"></template>"#, ParseErrorKind::InvalidAttribute, 22..25);
        case!("<template name='a' wx:if='' />", r#"<template name="a"></template>"#, ParseErrorKind::InvalidAttribute, 22..24);
        case!("<template is='a'><div/></template>", r#"<template is='a'></template>"#, ParseErrorKind::ChildNodesNotAllowed, 33..39);
        case!("<template is='a' bind:a />", r#"<template is='a' bind:a></template>"#);
        case!("<template is='a' mark:a />", r#"<template is='a' mark:a></template>"#);
        case!("<template is='a' slot='a' />", r#"<template is='a' slot='a'></template>"#);
        case!("<template name='a' bind:a />", r#"<template name='a'></template>"#, ParseErrorKind::InvalidAttribute, 19..23);
        case!("<template name='a' mark:a />", r#"<template name='a'></template>"#, ParseErrorKind::InvalidAttribute, 19..23);
        case!("<template name='a' slot='a' />", r#"<template name='a'></template>"#, ParseErrorKind::InvalidAttribute, 19..23);
    }

    #[test]
    fn include() {
        case!("<include src='a' />", r#"<include src="a"></include>"#);
        case!("<include a='' src='a' />", r#"<include src="a"></include>"#, ParseErrorKind::InvalidAttribute, 9..10);
        case!("<include src='a'><div/></include>", r#"<include></include>"#, ParseErrorKind::ChildNodesNotAllowed, 17..23);
        case!("<include src='a' catch:a />", r#"<include src='a' catch:a></include>"#);
        case!("<include src='a' mark:a />", r#"<include src='a' mark:a></include>"#);
        case!("<include src='a' slot='a' />", r#"<include src='a' slot='a'></include>"#);
    }

    #[test]
    fn slot() {
        case!("<slot a='a'></slot>", r#"<slot a="a"></slot>"#, ParseErrorKind::ChildNodesNotAllowed, 6..12);
        case!("<slot><div/></slot>", r#"<slot></slot>"#, ParseErrorKind::ChildNodesNotAllowed, 6..12);
        case!("<slot mut-bind:a />", r#"<slot mut-bind:a></slot>"#);
        case!("<slot mark:a />", r#"<slot mark:a></slot>"#);
        case!("<slot slot='a' />", r#"<slot slot='a'></slot>"#);
    }

    #[test]
    fn import() {
        case!("<import src='a' />", r#"<import src="a"></import>"#);
        case!("<import src='a' a />", r#"<import src="a"></import>"#, ParseErrorKind::InvalidAttribute, 16..17);
        case!("<import />", r#"<import src="a"></import>"#, ParseErrorKind::MissingSourcePath, 1..7);
        case!("<import src='a'><div/></import>", r#"<import src="a"></import>"#, ParseErrorKind::ChildNodesNotAllowed, 16..22);
    }

    #[test]
    fn script() {
        case!("<wxs src='a' module='a' />", r#"<wxs module="a" src="a"/>"#);
        case!("<wxs src='a' a module='a' />", r#"<wxs module="a" src="a"/>"#, ParseErrorKind::InvalidAttribute, 13..14);
        case!("<wxs module='a' /><wxs module='a' src='a' />", r#"<wxs module="a"/>"#, ParseErrorKind::DuplicatedName, 31..32);
        case!("<wxs src='a' module='a'><div/></wxs>", r#"<wxs module="a" src="a"/>"#, ParseErrorKind::ChildNodesNotAllowed, 13..19);
    }
}

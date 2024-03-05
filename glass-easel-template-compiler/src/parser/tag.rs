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
    pub imports: Vec<String>,
    pub includes: Vec<String>,
    pub sub_templates: Vec<(Name, Vec<Node>)>,
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
}

impl TemplateStructure for Node {
    fn location(&self) -> std::ops::Range<Position> {
        match self {
            Self::Text(x) => x.location(),
            Self::Element(x) => x.location(),
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
                    ps.skip_until_after("-->");
                } else {
                    ps.skip_until_after(">");
                    ps.add_warning(ParseErrorKind::UnrecognizedTag, range.start..ps.position());
                }
                continue;
            }
            if let Some([peek, peek2]) = ps.peek_n() {
                if peek == '<' && Name::is_start_char(peek2) {
                    Element::parse(ps, globals, ret);
                    continue;
                }
            }
            let value = Value::parse_until_before(ps, '<');
            if let Some(Node::Text(v)) = &mut ret.last_mut() {
                v.append(value);
            } else {
                ret.push(Node::Text(value));
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct Element {
    kind: ElementKind,
    start_tag_location: (Range<Position>, Range<Position>),
    close_location: Range<Position>,
    end_tag_location: Option<(Range<Position>, Range<Position>)>,
}

#[derive(Debug, Clone)]
pub enum ElementKind {
    Normal {
        tag_name: Name,
        attributes: Vec<Attribute>,
        class: ClassAttribute,
        style: StyleAttribute,
        change_attributes: Vec<Attribute>,
        worklet_attributes: Vec<(Name, Name)>,
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        data: Vec<(Name, Value)>,
        children: Vec<Node>,
        generics: Vec<(Name, Name)>,
        extra_attr: Vec<(Name, Name)>,
        slot: Option<(Range<Position>, Value)>,
        slot_value_refs: Vec<(Name, Name)>,
    },
    Pure {
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        children: Vec<Node>,
        slot: Option<(Range<Position>, Value)>,
    },
    For {
        list: (Range<Position>, Value),
        item_name: (Range<Position>, Name),
        index_name: (Range<Position>, Name),
        key: (Range<Position>, Name),
        children: Vec<Node>,
    },
    If {
        branches: Vec<(Range<Position>, Value, Vec<Node>)>,
        else_branch: Option<(Range<Position>, Vec<Node>)>,
    },
    TemplateRef {
        target: Value,
        data: Value,
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        slot: Option<(Range<Position>, Value)>,
    },
    Include {
        path: Name,
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        slot: Option<(Range<Position>, Value)>,
    },
    Slot {
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        slot: Option<Value>,
        name: Option<Value>,
        values: Vec<Attribute>,
    },
    Import {
        path: Name,
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
    fn parse(ps: &mut ParseState, globals: &mut TemplateGlobals, ret: &mut Vec<Node>) {
        // parse `<xxx`
        let start_tag_start_location = ps.consume_str("<").unwrap();
        let mut tag_name_slices = Name::parse_colon_separated(ps);
        debug_assert_ne!(tag_name_slices.len(), 0);
        let tag_name = if tag_name_slices.len() > 1 {
            let end = tag_name_slices.pop().unwrap();
            for x in tag_name_slices {
                ps.add_warning(ParseErrorKind::IllegalTagNamePrefix, x.location());
            }
            Name {
                name: CompactString::new_inline("wx-x"),
                location: end.location(),
            }
        } else {
            tag_name_slices[0]
        };
        ps.skip_whitespace();

        // create an empty element
        let default_attr_position = tag_name.location.end;
        let mut element = match tag_name.name.as_str() {
            "block" => {
                ElementKind::Pure {
                    event_bindings: vec![],
                    mark: vec![],
                    children: vec![],
                    slot: None,
                }
            }
            "template" => {
                ElementKind::TemplateRef {
                    target: Value::new_empty(default_attr_position),
                    data: Value::new_empty(default_attr_position),
                    event_bindings: vec![],
                    mark: vec![],
                    slot: None,
                }
            }
            "include" => {
                ElementKind::Include {
                    path: Name::new_empty(default_attr_position),
                    event_bindings: vec![],
                    mark: vec![],
                    slot: None,
                }
            }
            "slot" => {
                ElementKind::Slot {
                    event_bindings: vec![],
                    mark: vec![],
                    slot: None,
                    name: None,
                    values: vec![],
                }
            }
            "wxs" => {
                // TODO
                todo!()
            }
            _ => {
                ElementKind::Normal {
                    tag_name,
                    attributes: vec![],
                    class: ClassAttribute::None,
                    style: StyleAttribute::None,
                    change_attributes: vec![],
                    worklet_attributes: vec![],
                    event_bindings: vec![],
                    mark: vec![],
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
        let mut wx_for_index: Option<(Range<Position>, Name)> = None;
        let mut wx_for_item: Option<(Range<Position>, Name)> = None;
        let mut wx_key: Option<(Range<Position>, Name)> = None;
        let mut template_name: Option<(Range<Position>, Name)> = None;
        let mut class_attrs: Vec<(Range<Position>, Name, Value)> = vec![];
        let mut style_attrs: Vec<(Range<Position>, Name, Value)> = vec![];
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
            } else if Name::is_start_char(peek) {
                // decide the attribute kind
                enum AttrPrefixKind {
                    Normal,
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
                let mut segs = Name::parse_colon_separated(ps);
                let attr_name = segs.pop().unwrap();
                let prefix = if segs.len() <= 1 {
                    match segs.first() {
                        None => {
                            match (&element, attr_name.name.as_str()) {
                                (ElementKind::TemplateRef { .. }, "name") => AttrPrefixKind::TemplateName,
                                (ElementKind::TemplateRef { .. }, "is") => AttrPrefixKind::TemplateIs,
                                (ElementKind::TemplateRef { .. }, "data") => AttrPrefixKind::TemplateData,
                                (ElementKind::Include { .. }, "src") => AttrPrefixKind::Src,
                                (ElementKind::Import { .. }, "src") => AttrPrefixKind::Src,
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
                    StaticStr(Name),
                    ScopeName(Name),
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
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(Name::new_empty(pos)),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(Name::new_empty(pos)),
                            }
                        }
                        Some(ch) if ch == '"' || ch == '\'' => {
                            // parse as `"..."`
                            if let Some(range) = ws_after_eq {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            ps.next(); // ch
                            let value = match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::parse_until_before(ps, ch)),
                                AttrPrefixParseKind::StaticStr => {
                                    let v = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    if v.name.as_str().contains("{{") {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, v.location());
                                    }
                                    AttrPrefixParseResult::StaticStr(v)
                                },
                                AttrPrefixParseKind::ScopeName => {
                                    let v = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    if !v.is_valid_identifier() {
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
                            let value = Value::parse_data_binding(ps).map(Value::from_expression);
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
                            let v = Name::parse_identifier_like_until_before(ps, |x| !Name::is_following_char(x));
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
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(Name::new_empty(pos)),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(Name::new_empty(pos)),
                            }
                        }
                    };
                    ps.skip_whitespace();
                    attr_value
                } else {
                    let pos = attr_name.location.end;
                    match parse_kind {
                        AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                        AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(Name::new_empty(pos)),
                        AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(Name::new_empty(pos)),
                    }
                };

                // apply attribute value according to its kind
                fn add_element_event_binding(
                    ps: &mut ParseState,
                    element: &mut ElementKind,
                    attr_name: Name,
                    attr_value: AttrPrefixParseResult,
                    is_catch: bool,
                    is_mut: bool,
                    is_capture: bool,
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
                                    });
                                }
                            }
                        }
                        ElementKind::For { .. } |
                        ElementKind::If { .. } |
                        ElementKind::Import { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    }
                }
                match prefix {
                    AttrPrefixKind::Normal => {
                        match &mut element {
                            ElementKind::Normal { attributes, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if attributes.iter().find(|x| x.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        let attr = Attribute { kind: AttributeKind::Normal, name: attr_name, value };
                                        attributes.push(attr);
                                    }
                                }
                            }
                            ElementKind::Slot { values, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if values.iter().find(|x| x.name.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        let attr = Attribute { kind: AttributeKind::Normal, name: attr_name, value };
                                        values.push(attr);
                                    }
                                }
                            }
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
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
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                if value.name.len() > 0 {
                                    ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
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
                                    if target.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *target = value;
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
                                    if data.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *data = value;
                                    }
                                }
                            }
                            _ => unreachable!(),
                        }
                    }
                    AttrPrefixKind::Src => {
                        match &mut element {
                            ElementKind::Include { path, .. } |
                            ElementKind::Import { path, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if path.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *path = s;
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
                                        let attr = Attribute { kind: AttributeKind::Model(prefix_location), name: attr_name, value };
                                        attributes.push(attr);
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
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
                                        let attr = Attribute { kind: AttributeKind::Normal, name: attr_name, value };
                                        change_attributes.push(attr);
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Worklet(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { worklet_attributes, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if worklet_attributes.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        worklet_attributes.push((attr_name, s));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Data(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { data, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if data.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        data.push((attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
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
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
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
                                        class_attrs.push((prefix_location, attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Bind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, false, false);
                    }
                    AttrPrefixKind::MutBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, true, false);
                    }
                    AttrPrefixKind::Catch(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, true, false, false);
                    }
                    AttrPrefixKind::CaptureBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, false, true);
                    }
                    AttrPrefixKind::CaptureMutBind(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, false, true, true);
                    }
                    AttrPrefixKind::CaptureCatch(prefix_location) => {
                        add_element_event_binding(ps, &mut element, attr_name, attr_value, true, false, true);
                    }
                    AttrPrefixKind::Mark(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { mark, .. } |
                            ElementKind::Pure { mark, .. } |
                            ElementKind::TemplateRef { mark, .. } |
                            ElementKind::Include { mark, .. } |
                            ElementKind::Slot { mark, .. } => {
                                if let AttrPrefixParseResult::Value(value) = attr_value {
                                    if mark.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        mark.push((attr_name, value));
                                    }
                                }
                            }
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Generic(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { generics, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if generics.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        generics.push((attr_name, s));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::ExtraAttr(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { extra_attr, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                    if extra_attr.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        extra_attr.push((attr_name, s));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::SlotDataRef(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { slot_value_refs, .. } => {
                                if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                                    if slot_value_refs.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        slot_value_refs.push((attr_name, s));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateRef { .. } |
                            ElementKind::Include { .. } |
                            ElementKind::Import { .. } => {
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
                    if peek == '/' || peek == '>' || Name::is_start_char(peek) || char::is_whitespace(peek) {
                        break
                    }
                }
                ps.add_warning(ParseErrorKind::IllegalAttributeName, pos..ps.position());
                ps.skip_whitespace();
            }
        }

        // validate class & style attributes
        // TODO support `class:xxx` and `style:xxx`

        // check `<template name>` and validate `<template is data>`
        if template_name.is_some() {
            let ElementKind::TemplateRef { target, data, event_bindings, mark, slot } = element else {
                unreachable!();
            };
            if target.location().end != default_attr_position {
                ps.add_warning(ParseErrorKind::InvalidAttribute, target.location());
            }
            if data.location().end != default_attr_position {
                ps.add_warning(ParseErrorKind::InvalidAttribute, target.location());
            }
            for x in event_bindings {
                ps.add_warning(ParseErrorKind::InvalidAttribute, x.name.location());
            }
            for (x, _) in mark {
                ps.add_warning(ParseErrorKind::InvalidAttribute, x.location());
            }
            if let Some((x, _)) = slot {
                ps.add_warning(ParseErrorKind::InvalidAttribute, x);
            }
        }

        // end the start tag
        let (self_close_location, start_tag_end_location) = match ps.peek::<0>() {
            None => {
                ps.add_warning(ParseErrorKind::IncompleteTag, start_tag_start_location);
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

        // parse children
        let new_children = if self_close_location.is_none() {
            let mut new_children = vec![];
            Node::parse_vec_node(ps, globals, &mut new_children);
            new_children
        } else {
            vec![]
        };

        // parse end tag
        let (close_location, end_tag_location) = if let Some(close_location) = self_close_location {
            (close_location, None)
        } else {
            let close_with_end_tag_location = ps.try_parse(|ps| {
                ps.skip_whitespace();
                if ps.peek::<0>().is_none() {
                    ps.add_warning(ParseErrorKind::MissingEndTag, start_tag_start_location);
                    return None;
                }
                let end_tag_start_location = ps.consume_str("<").unwrap();
                let close_location = ps.consume_str("/").unwrap();
                let mut tag_name_slices = Name::parse_colon_separated(ps);
                let end_tag_name = if tag_name_slices.len() > 1 {
                    let end = tag_name_slices.pop().unwrap();
                    for x in tag_name_slices {
                        ps.add_warning(ParseErrorKind::IllegalTagNamePrefix, x.location());
                    }
                    Name {
                        name: CompactString::new_inline("wx-x"),
                        location: end.location(),
                    }
                } else {
                    tag_name_slices[0]
                };
                if end_tag_name.name != tag_name.name {
                    return None;
                }
                ps.skip_whitespace();
                let mut end_tag_end_pos = ps.position();
                if let Some(s) = ps.skip_until_after(">") {
                    ps.add_warning(ParseErrorKind::UnexpectedCharacter, end_tag_end_pos..ps.position());
                }
                let end_tag_location = (end_tag_start_location, end_tag_end_pos..ps.position());
                Some((close_location, end_tag_location))
            });
            if close_with_end_tag_location.is_none() {
                ps.add_warning(ParseErrorKind::MissingEndTag, tag_name.location);
            }
            let close_location = close_with_end_tag_location
                .as_ref()
                .map(|(x, _)| x.clone())
                .unwrap_or_else(|| start_tag_end_location);
            let end_tag_location = close_with_end_tag_location.map(|(_, x)| x);
            (close_location, end_tag_location)
        };

        // collect include and import sources
        match &element {
            ElementKind::Include { path, .. } => {
                globals.includes.push(path.name.to_string());
            }
            ElementKind::Import { path } => {
                globals.imports.push(path.name.to_string());
            }
            _ => {}
        }

        // extract `wx:for`
        enum ForList {
            None,
            For {
                list: (Range<Position>, Value),
                item_name: (Range<Position>, Name),
                index_name: (Range<Position>, Name),
                key: (Range<Position>, Name),
            },
        }
        let for_list = if template_name.is_some() || wx_for.is_none() {
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
            let item_name = wx_for_item.unwrap_or_else(|| (for_location.clone(), Name::new_empty(for_location.end.clone())));
            let index_name = wx_for_index.unwrap_or_else(|| (for_location.clone(), Name::new_empty(for_location.end.clone())));
            let key = wx_key.unwrap_or_else(|| (for_location.clone(), Name::new_empty(for_location.end.clone())));
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
        let if_condition = if template_name.is_some() {
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
        if let Some((_, name)) = template_name {
            if globals.sub_templates.iter().find(|(x, _)| x.name_eq(&name)).is_some() {
                ps.add_warning(ParseErrorKind::DuplicatedAttribute, name.location());
            } else {
                globals.sub_templates.push((name, new_children));
            }
        } else {
            let wrap_children = |element: Element| -> Vec<Node> {
                match element.kind {
                    ElementKind::Pure { event_bindings, mark, slot, children } => {
                        if !event_bindings.is_empty() || !mark.is_empty() || slot.is_some() {
                            // empty
                        } else {
                            return children;
                        }
                    }
                    _ => {}
                }
                vec![Node::Element(element)]
            };

            // generate normal element
            let wrapped_element = {
                match &mut element {
                    ElementKind::Normal { children, .. } |
                    ElementKind::Pure { children, .. } => {
                        *children = new_children;
                    }
                    ElementKind::For { .. } |
                    ElementKind::If { .. } => {
                        unreachable!()
                    }
                    ElementKind::TemplateRef { .. } |
                    ElementKind::Include { .. } |
                    ElementKind::Slot { .. } |
                    ElementKind::Import { .. } => {
                        if let Some(child) = new_children.first() {
                            ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, child.location());
                        }
                    }
                }
                Element {
                    kind: element,
                    start_tag_location: (start_tag_start_location.clone(), start_tag_end_location.clone()),
                    close_location: close_location.clone(),
                    end_tag_location: end_tag_location.clone(),
                }
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
    pub kind: AttributeKind,
    pub name: Name,
    pub value: Value,
}

#[derive(Debug, Clone)]
pub enum AttributeKind {
    Normal,
    Model(Range<Position>),
}

#[derive(Debug, Clone)]
pub enum ClassAttribute {
    None,
    String(Value),
    Multiple(Vec<(Name, Value)>),
}

#[derive(Debug, Clone)]
pub enum StyleAttribute {
    None,
    String(Value),
    Multiple(Vec<(Name, Value)>),
}

#[derive(Debug, Clone)]
pub struct EventBinding {
    pub name: Name,
    pub value: Value,
    pub is_catch: bool,
    pub is_mut: bool,
    pub is_capture: bool,
}

#[derive(Debug, Clone)]
pub struct Name {
    pub name: CompactString,
    pub location: Range<Position>,
}

impl TemplateStructure for Name {
    fn location(&self) -> Range<Position> {
        self.location.clone()
    }
}

impl Name {
    fn is_start_char(ch: char) -> bool {
        ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ch == '_' || ch == ':'
    }

    fn is_following_char(ch: char) -> bool {
        Self::is_start_char(ch) || ('0'..='9').contains(&ch) || ch == '-' || ch == '.'
    }

    fn is_empty(&self) -> bool {
        self.name.is_empty()
    }

    fn name_eq(&self, other: &Self) -> bool {
        self.name == other.name
    }

    fn new_empty(pos: Position) -> Self {
        Self {
            name: CompactString::new_inline(""),
            location: pos..pos,
        }
    }

    fn parse_colon_separated(ps: &mut ParseState) -> Vec<Self> {
        let Some(peek) = ps.peek::<0>() else {
            return vec![];
        };
        if !Self::is_start_char(peek) {
            return vec![];
        }
        let mut ret = Vec::with_capacity(2);
        let mut cur_name = Self::new_empty(ps.position());
        loop {
            match ps.next().unwrap() {
                ':' => {
                    let prev = std::mem::replace(&mut cur_name, Self::new_empty(ps.position()));
                    ret.push(prev);
                }
                ch => {
                    cur_name.name.push(ch);
                    cur_name.location.end = ps.position();
                }
            }
            let Some(peek) = ps.peek() else { break };
            if !Self::is_following_char(peek) { break };
        }
        ret
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

    fn parse_identifier_like_until_before(ps: &mut ParseState, until: impl Fn(char) -> bool) -> Self {
        let mut name = CompactString::new_inline("");
        let start_pos = ps.position();
        loop {
            match ps.peek() {
                None => break,
                Some(ch) if until(ch) => break,
                Some(ch) => {
                    name.push_str(&Name::parse_next_entity(ps));
                }
            }
        }
        Self {
            name,
            location: start_pos..ps.position(),
        }
    }

    fn is_valid_identifier(&self) -> bool {
        let mut chars = self.name.chars();
        let first = chars.next();
        match first {
            None => false,
            Some(ch) if !Name::is_start_char(ch) => false,
            Some(_) => {
                chars.find(|ch| !Name::is_following_char(*ch)).is_none()
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
        binding_map_keys: Option<BindingMapKeys>,
    },
}

impl TemplateStructure for Value {
    fn location(&self) -> Range<Position> {
        match self {
            Self::Static { value: _, location } => location.clone(),
            Self::Dynamic { expression, binding_map_keys: _ } => expression.location(),
        }
    }
}

impl Value {
    fn new_empty(pos: Position) -> Self {
        Self::Static { value: CompactString::new_inline(""), location: pos..pos }
    }

    fn from_expression(expression: Box<Expression>) -> Self {
        Self::Dynamic { expression, binding_map_keys: None }
    }

    fn parse_data_binding(ps: &mut ParseState) -> Option<Box<Expression>> {
        if ps.consume_str("{{").is_none() {
            return None;
        }
        if ps.peek() != Some('{') {
            return None;
        }
        let Some(expr) = Expression::parse_expression_or_object_inner(ps) else {
            ps.skip_until_after("}}");
            return None;
        };
        ps.skip_whitespace();
        let end_pos = ps.position();
        match ps.skip_until_after("}}") {
            None => {
                ps.add_warning(ParseErrorKind::MissingExpressionEnd, end_pos..ps.position());
            }
            Some(s) => {
                if s.len() > 0 {
                    ps.add_warning(ParseErrorKind::IllegalExpression, end_pos..ps.position());
                }
            }
        }
        Some(expr)
    }

    fn parse_until_before(ps: &mut ParseState, until: char) -> Self {
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
            let Some(peek) = ps.peek() else { break };
            if peek == until { break };
            let start_pos = ps.position();

            // try parse `{{ ... }}`
            if peek == '{' {
                if let Some(expr) = ps.try_parse(Self::parse_data_binding) {
                    let expression = match ret {
                        Self::Static { value, location } => {
                            if value.is_empty() {
                                expr
                            } else {
                                let left = Box::new(Expression::LitStr { value, location });
                                let right = wrap_to_string(expr, start_pos..start_pos);
                                Box::new(Expression::Plus { left, right, location: start_pos..start_pos })
                            }
                        }
                        Self::Dynamic { expression: left, binding_map_keys } => {
                            let left = wrap_to_string(left, start_pos..start_pos);
                            let right = wrap_to_string(expr, start_pos..start_pos);
                            Box::new(Expression::Plus { left, right, location: start_pos..start_pos })
                        }
                    };
                    ret = Self::Dynamic { expression, binding_map_keys: None };
                    continue;
                }
            }

            // convert `Self` format if needed
            ret = if let Self::Dynamic { expression, binding_map_keys } = ret {
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
                    let left = wrap_to_string(expression, start_pos..start_pos);
                    let right = Box::new(Expression::LitStr { value: CompactString::new_inline(""), location: start_pos..start_pos });
                    let expr = Box::new(Expression::Plus { left, right, location: start_pos..start_pos });
                    Self::Dynamic { expression, binding_map_keys }
                } else {
                    Self::Dynamic { expression, binding_map_keys }
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
            ret_value.push_str(&Name::parse_next_entity(ps));
            ret_location.end = ps.position();
        }
        ret
    }

    fn append(&mut self, other: Self) {
        // TODO
        todo!()
    }
}

#[derive(Debug, Clone)]
pub enum Script {
    Inline {
        module_name: CompactString,
        content: String,
    },
    GlobalRef {
        module_name: CompactString,
        rel_path: String,
    },
}

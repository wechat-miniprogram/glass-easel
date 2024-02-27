use std::{borrow::Cow, collections::HashMap, ops::Range};

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
    pub sub_templates: HashMap<CompactString, Vec<Node>>,
    pub scripts: Vec<Script>,
}

impl Template {
    pub(super) fn parse(ps: &mut ParseState) -> Self {
        let mut globals = TemplateGlobals {
            imports: vec![],
            includes: vec![],
            sub_templates: HashMap::with_capacity(0),
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
            let Some(peek) = ps.peek_n_without_whitespace::<2>() else { return };
            let node = match peek {
                ['<', '/'] => {
                    // tag end, returns
                    break;
                }
                ['<', '!'] => {
                    // special tags
                    // currently we only support comments
                    // report a warning on other cases
                    let start_pos = ps.position();
                    ps.next_without_whitespace(); // '<'
                    ps.next_with_whitespace(); // '!'
                    if ps.peek_n_with_whitespace::<2>() == Some(['-', '-']) {
                        ps.next_with_whitespace(); // '-'
                        ps.next_with_whitespace(); // '-'
                        ps.skip_until_after("-->");
                    } else {
                        ps.skip_until_after(">");
                        ps.add_warning(ParseErrorKind::UnrecognizedTag, start_pos..ps.position());
                    }
                    continue;
                }
                ['<', x] if Name::is_start_char(x) => {
                    // an element
                    Self::Element(Element::parse(ps, globals))
                }
                _ => Self::Text(Value::parse_until_before(ps, '<')),
            };
            ret.push(node);
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
        worklet_attributes: Vec<(Name, CompactString, Range<Position>)>,
        event_bindings: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        data: Vec<(Name, Value)>,
        children: Vec<Node>,
        generics: Vec<(Name, CompactString, Range<Position>)>,
        extra_attr: Vec<(Name, CompactString, Range<Position>)>,
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
        list: Value,
        item_name: Name,
        index_name: Name,
        key: Name,
        children: Vec<Node>,
    },
    If {
        branches: Vec<(Value, Vec<Node>)>,
    },
    TemplateDefinition {
        name: Name,
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

impl Element {
    fn parse(ps: &mut ParseState, globals: &mut TemplateGlobals) -> Self {
        // parse `<xxx`
        let start_angle_start = ps.position();
        assert_eq!(ps.next_without_whitespace(), Some('<'));
        let start_tag_start_location = start_angle_start..ps.position();
        let mut tag_name_slices = Name::parse_colon_separated(ps);
        assert_ne!(tag_name_slices.len(), 0);
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
        let mut wx_if = None;
        let mut wx_for = None;
        let mut wx_for_index = None;
        let mut wx_for_item = None;
        let mut wx_key = None;
        let mut template_name = None;
        let mut class_attrs: Vec<(Name, Value)> = vec![];
        let mut style_attrs: Vec<(Name, Value)> = vec![];
        loop {
            ps.skip_whitespace();
            let Some(peek) = ps.peek_with_whitespace::<0>() else { break };
            if peek == '>' {
                break;
            }
            if peek == '/' {
                // maybe self-close
                if ps.peek_with_whitespace::<1>() == Some('>') {
                    break;
                }
                let pos = ps.position();
                ps.next_with_whitespace(); // '/'
                ps.add_warning(ParseErrorKind::IllegalCharacter, pos..ps.position());
            } else if Name::is_start_char(peek) {
                // decide the attribute kind
                enum AttrPrefixKind {
                    Normal,
                    WxIf,
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
                    StaticStr(CompactString, Range<Position>),
                    ScopeName(Name),
                }
                let attr_value = if ps.peek_without_whitespace::<0>() == Some('=') {
                    if let Some(range) = ps.skip_whitespace() {
                        ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                    }
                    ps.next_with_whitespace(); // '='
                    match ps.peek_without_whitespace::<0>() {
                        None | Some('>') | Some('/') => {
                            let pos = ps.position();
                            ps.add_warning_at_current_position(ParseErrorKind::MissingAttributeValue);
                            match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(CompactString::new_inline(""), pos..pos),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(Name::new_empty(pos)),
                            }
                        }
                        Some(ch) if ch == '"' || ch == '\'' => {
                            // parse as `"..."`
                            if let Some(range) = ps.skip_whitespace() {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            ps.next_with_whitespace(); // ch
                            let value = match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::parse_until_before(ps, ch)),
                                AttrPrefixParseKind::StaticStr => {
                                    let v = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    if v.name.as_str().contains("{{") {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, v.location());
                                    }
                                    AttrPrefixParseResult::StaticStr(v.name, v.location)
                                },
                                AttrPrefixParseKind::ScopeName => {
                                    let v = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    if !v.is_valid_identifier() {
                                        ps.add_warning(ParseErrorKind::InvalidIdentifier, v.location());
                                    }
                                    AttrPrefixParseResult::ScopeName(v)
                                },
                            };
                            ps.next_with_whitespace(); // ch
                            value
                        }
                        Some('{') if ps.peek_without_whitespace::<1>() == Some('{') => {
                            // parse `{{...}}`
                            if let Some(range) = ps.skip_whitespace() {
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
                        Some(_) => {
                            let v = Name::parse_identifier_like_until_before(ps, |x| !Name::is_following_char(x));
                            match parse_kind {
                                AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::Static { value: v.name, location: v.location }),
                                AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(v.name, v.location),
                                AttrPrefixParseKind::ScopeName => AttrPrefixParseResult::ScopeName(v),
                            }
                        }
                    }
                } else {
                    let pos = attr_name.location.end;
                    match parse_kind {
                        AttrPrefixParseKind::Value => AttrPrefixParseResult::Value(Value::new_empty(pos)),
                        AttrPrefixParseKind::StaticStr => AttrPrefixParseResult::StaticStr(CompactString::new_inline(""), pos..pos),
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
                        ElementKind::TemplateDefinition { .. } |
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
                            ElementKind::TemplateDefinition { .. } |
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
                                wx_if = Some(value);
                            }
                        }
                    }
                    AttrPrefixKind::WxFor => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_for.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for = Some(value);
                            }
                        }
                    }
                    AttrPrefixKind::WxForIndex => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_index.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for_index = Some(s);
                            }
                        }
                    }
                    AttrPrefixKind::WxForItem => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_item.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_for_item = Some(s);
                            }
                        }
                    }
                    AttrPrefixKind::WxKey => {
                        if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                            if wx_key.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                wx_key = Some((s, location));
                            }
                        }
                    }
                    AttrPrefixKind::TemplateName => {
                        if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                            if template_name.is_some() {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            } else {
                                template_name = Some(Name { name: s, location });
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
                                if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                                    if path.location().end != default_attr_position {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        *path = Name { name: s, location };
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
                            ElementKind::TemplateDefinition { .. } |
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
                            ElementKind::TemplateDefinition { .. } |
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
                                if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                                    if worklet_attributes.iter().find(|(x, _, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        worklet_attributes.push((attr_name, s, location));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateDefinition { .. } |
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
                            ElementKind::TemplateDefinition { .. } |
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
                                    if class_attrs.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        class_attrs.push((attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateDefinition { .. } |
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
                                    if class_attrs.iter().find(|(x, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        class_attrs.push((attr_name, value));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateDefinition { .. } |
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
                            ElementKind::TemplateDefinition { .. } |
                            ElementKind::Import { .. } => {
                                ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                            }
                        }
                    }
                    AttrPrefixKind::Generic(prefix_location) => {
                        match &mut element {
                            ElementKind::Normal { generics, .. } => {
                                if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                                    if generics.iter().find(|(x, _, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        generics.push((attr_name, s, location));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateDefinition { .. } |
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
                                if let AttrPrefixParseResult::StaticStr(s, location) = attr_value {
                                    if extra_attr.iter().find(|(x, _, _)| x.name_eq(&attr_name)).is_some() {
                                        ps.add_warning(ParseErrorKind::DuplicatedAttribute, attr_name.location);
                                    } else {
                                        extra_attr.push((attr_name, s, location));
                                    }
                                }
                            }
                            ElementKind::Slot { .. } |
                            ElementKind::Pure { .. } |
                            ElementKind::For { .. } |
                            ElementKind::If { .. } |
                            ElementKind::TemplateDefinition { .. } |
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
                            ElementKind::TemplateDefinition { .. } |
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
                    ps.next_without_whitespace();
                    let Some(peek) = ps.peek_without_whitespace::<0>() else { break };
                    if peek == '/' || peek == '>' || Name::is_start_char(peek) {
                        break
                    }
                }
                ps.add_warning(ParseErrorKind::IllegalAttributeName, pos..ps.position());
            }
        }

        // validate class & style attributes
        // TODO

        // extract `<template name>` and validate `<template is data>`
        if let Some(template_name) = template_name {
            let old_element = std::mem::replace(&mut element, ElementKind::TemplateDefinition { name: template_name });
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

        // extract `wx:for` as an independent layer
        // TODO

        // end the start tag
        let start_tag_end_location = match ps.peek_without_whitespace() {
            None => {
                ps.add_warning(ParseErrorKind::IncompleteTag, start_tag_start_location);
                let pos = ps.position();
                return Element {
                    kind: element,
                    start_tag_location: (start_tag_start_location, pos..pos),
                    close_location: pos..pos,
                    end_tag_location: None,
                };
            }
            Some('/') => {
                let close_pos = ps.position();
                ps.next_without_whitespace(); // '/'
                let start_tag_end_pos = ps.position();
                let close_location = close_pos..start_tag_end_pos.clone();
                assert_eq!(ps.next_with_whitespace(), Some('>'));
                let start_tag_end_location = start_tag_end_pos..ps.position();
                return Element {
                    kind: element,
                    start_tag_location: (start_tag_start_location, start_tag_end_location),
                    close_location,
                    end_tag_location: None,
                };
            }
            Some('>') => {
                let pos = ps.position();
                ps.next_without_whitespace(); // '>'
                pos..ps.position()
            }
            _ => unreachable!()
        };

        // parse children
        let mut new_children = vec![];
        Node::parse_vec_node(ps, globals, &mut new_children);
        match &mut element {
            ElementKind::Normal { children, .. } |
            ElementKind::Pure { children, .. } |
            ElementKind::For { children, .. } => {
                *children = new_children;
            }
            ElementKind::If { branches } => {
                // TODO
                todo!()
            }
            ElementKind::TemplateDefinition { name } => {
                globals.sub_templates.insert(name.name.clone(), new_children);
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

        // parse end tag
        let close_with_end_tag_location = ps.try_parse(|ps| {
            ps.skip_whitespace();
            if ps.peek_with_whitespace().is_none() {
                ps.add_warning(ParseErrorKind::MissingEndTag, start_tag_start_location);
                return None;
            }
            let end_tag_start_pos = ps.position();
            assert_eq!(ps.next_with_whitespace(), Some('<'));
            let close_pos = ps.position();
            let end_tag_start_location = end_tag_start_pos..close_pos;
            assert_eq!(ps.next_with_whitespace(), Some('/'));
            let close_location = close_pos..ps.position();
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
                ps.add_warning(ParseErrorKind::IllegalCharacter, end_tag_end_pos..ps.position());
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

        Element {
            kind: element,
            start_tag_location: (start_tag_start_location, start_tag_end_location),
            close_location,
            end_tag_location,
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
        let Some(peek) = ps.peek_with_whitespace::<0>() else {
            return vec![];
        };
        if !Self::is_start_char(peek) {
            return vec![];
        }
        let mut ret = Vec::with_capacity(2);
        let mut cur_name = Self::new_empty(ps.position());
        loop {
            match ps.next_with_whitespace().unwrap() {
                ':' => {
                    let prev = std::mem::replace(&mut cur_name, Self::new_empty(ps.position()));
                    ret.push(prev);
                }
                ch => {
                    cur_name.name.push(ch);
                    cur_name.location.end = ps.position();
                }
            }
            let Some(peek) = ps.peek_with_whitespace() else { break };
            if !Self::is_following_char(peek) { break };
        }
        ret
    }

    fn parse_next_entity<'s>(ps: &mut ParseState<'s>) -> Cow<'s, str> {
        if ps.peek_with_whitespace() == Some('&') {
            let s = ps.try_parse(|ps| {
                let start = ps.cur_index();
                let start_pos = ps.position();
                ps.next_with_whitespace(); // '&'
                let next = ps.next_with_whitespace()?;
                if next == '#' {
                    let next = ps.next_with_whitespace()?;
                    if next == 'x' {
                        // parse `&#x...;`
                        loop {
                            let Some(next) = ps.next_with_whitespace() else {
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
                            let Some(next) = ps.next_with_whitespace() else {
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
                        let next = ps.next_with_whitespace()?;
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
            match ps.peek_with_whitespace() {
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
        expr: Box<Expression>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

impl TemplateStructure for Value {
    fn location(&self) -> Range<Position> {
        match self {
            Self::Static { value: _, location } => location.clone(),
            Self::Dynamic { expr, binding_map_keys: _ } => expr.location(),
        }
    }
}

impl Value {
    fn new_empty(pos: Position) -> Self {
        Self::Static { value: CompactString::new_inline(""), location: pos..pos }
    }

    fn from_expression(expr: Box<Expression>) -> Self {
        Self::Dynamic { expr, binding_map_keys: None }
    }

    fn parse_data_binding(ps: &mut ParseState) -> Option<Box<Expression>> {
        ps.next_with_whitespace(); // '{'
        if ps.peek_with_whitespace() != Some('{') {
            return None;
        }
        let expr = Expression::parse_expression_or_object_inner(ps);
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
        loop {
            let Some(peek) = ps.peek_with_whitespace() else { break };
            if peek == until { break };
            let start_pos = ps.position();

            // try parse `{{ ... }}`
            if peek == '{' {
                if let Some(expr) = ps.try_parse(Self::parse_data_binding) {
                    let (new_expr, binding_map_keys) = match ret {
                        Self::Static { value, location } => {
                            let left = Box::new(Expression::LitStr { value, location });
                            (Expression::Plus { left, right: expr, location: start_pos..start_pos }, None)
                        }
                        Self::Dynamic { expr: left, binding_map_keys } => {
                            (Expression::Plus { left, right: expr, location: start_pos..start_pos }, binding_map_keys)
                        }
                    };
                    ret = Self::Dynamic { expr: Box::new(new_expr), binding_map_keys };
                    continue;
                }
            }

            // convert `Self` format if needed
            ret = if let Self::Dynamic { expr, binding_map_keys } = ret {
                let need_convert = if let Expression::Plus { right, .. } = &*expr {
                    if let Expression::LitStr { .. } = &**right {
                        false
                    } else {
                        true
                    }
                } else {
                    true
                };
                if need_convert {
                    let right = Box::new(Expression::LitStr { value: CompactString::new_inline(""), location: start_pos..start_pos });
                    let expr = Box::new(Expression::Plus { left: expr, right, location: start_pos..start_pos });
                    Self::Dynamic { expr, binding_map_keys }
                } else {
                    Self::Dynamic { expr, binding_map_keys }
                }
            } else {
                ret
            };
            let (ret_value, ret_location) = match &mut ret {
                Self::Static { value, location } => (value, location),
                Self::Dynamic { expr, .. } => {
                    if let Expression::Plus { right, .. } = &mut **expr {
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

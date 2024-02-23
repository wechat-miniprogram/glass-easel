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
    pub sub_templates: HashMap<String, Vec<Node>>,
    pub scripts: Vec<Script>,
}

impl Template {
    pub(super) fn parse(ps: &mut ParseState) -> Self {
        let mut globals = TemplateGlobals {
            imports: Vec::with_capacity(0),
            includes: Vec::with_capacity(0),
            sub_templates: HashMap::with_capacity(0),
            scripts: Vec::with_capacity(0),
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
    start_angle_location: (Range<Position>, Range<Position>),
    close_location: Range<Position>,
    end_angle_location: Option<(Range<Position>, Range<Position>)>,
}

#[derive(Debug, Clone)]
pub enum ElementKind {
    Normal {
        tag_name: Name,
        attributes: Vec<Attribute>,
        class: ClassAttribute,
        style: StyleAttribute,
        event_binding: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        children: Vec<Node>,
        generics: Vec<(Name, CompactString, Range<Position>)>,
        extra_attr: Vec<(Name, CompactString, Range<Position>)>,
        slot: Option<Value>,
        slot_value_refs: Vec<(Name, Name)>,
    },
    Pure {
        event_binding: Vec<EventBinding>,
        mark: Vec<(Name, Value)>,
        children: Vec<Node>,
        slot: Value,
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
    TemplateRef {
        target: Value,
        data: Value,
        slot: Value,
    },
    Include {
        path: Name,
        slot: Value,
    },
    Slot {
        name: Value,
        values: Vec<Attribute>,
    },
}

impl Element {
    fn parse(ps: &mut ParseState, globals: &mut TemplateGlobals) -> Self {
        // parse `<xxx`
        let start_angle_start = ps.position();
        assert_eq!(ps.next_without_whitespace(), Some('<'));
        let start_angle_location = start_angle_start..ps.position();
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

        // parse attributes
        let mut wx_if = None;
        let mut wx_for = None;
        let mut wx_for_index = None;
        let mut wx_for_item = None;
        let mut wx_key = None;
        let mut normal_attrs = Vec::with_capacity(0);
        let mut class_attr = ClassAttribute::None;
        let mut style_attr = StyleAttribute::None;
        let mut children = Vec::with_capacity(0);
        let mut generics = Vec::with_capacity(0);
        let mut extra_attr = Vec::with_capacity(0);
        let mut slot = None;
        let mut slot_value_refs = Vec::with_capacity(0);
        loop {
            ps.skip_whitespace();
            let Some(peek) = ps.peek_with_whitespace::<0>() else { break };
            if peek == '/' {
                // maybe self-close
                if ps.peek_with_whitespace::<1>() == Some('>') {
                    break;
                }
                let pos = ps.position();
                ps.next_with_whitespace(); // '/'
                ps.add_warning(ParseErrorKind::IllegalCharacter, pos..ps.position());
            } else if Name::is_start_char(peek) {
                // resolve attribute according to its kind
                #[derive(Debug, PartialEq)]
                enum AttrPrefixKind {
                    Normal,
                    WxIf,
                    WxFor,
                    WxForIndex,
                    WxForItem,
                    WxKey,
                    Model,
                    Change,
                    Worklet,
                    Data,
                    Class,
                    Style,
                    Bind,
                    MutBind,
                    Catch,
                    CaptureBind,
                    CaptureMutBind,
                    CaptureCatch,
                    Mark,
                    Generic,
                    ExtraAttr,
                    SlotDataRef,
                    Invalid,
                }
                let segs = Name::parse_colon_separated(ps);
                let name = segs.pop().unwrap();
                let prefix = if segs.len() <= 1 {
                    match segs.first() {
                        None => AttrPrefixKind::Normal,
                        Some(x) => match x.name.as_str() {
                            "wx" => match name.name.as_str() {
                                "if" => AttrPrefixKind::WxIf,
                                "for" => AttrPrefixKind::WxFor,
                                "for-index" => AttrPrefixKind::WxForIndex,
                                "for-item" => AttrPrefixKind::WxForItem,
                                "key" => AttrPrefixKind::WxKey,
                            },
                            "model" => AttrPrefixKind::Model,
                            "change" => AttrPrefixKind::Change,
                            "worklet" => AttrPrefixKind::Worklet,
                            "data" => AttrPrefixKind::Data,
                            "class" => AttrPrefixKind::Class,
                            "style" => AttrPrefixKind::Style,
                            "bind" => AttrPrefixKind::Bind,
                            "mut-bind" => AttrPrefixKind::MutBind,
                            "catch" => AttrPrefixKind::Catch,
                            "capture-bind" => AttrPrefixKind::CaptureBind,
                            "capture-mut-bind" => AttrPrefixKind::CaptureMutBind,
                            "capture-catch" => AttrPrefixKind::CaptureCatch,
                            "mark" => AttrPrefixKind::Mark,
                            "generic" => AttrPrefixKind::Generic,
                            "extra-attr" => AttrPrefixKind::ExtraAttr,
                            "slot" => AttrPrefixKind::SlotDataRef,
                            _ => AttrPrefixKind::Invalid,
                        }
                    }
                } else {
                    AttrPrefixKind::Invalid
                };
                if prefix == AttrPrefixKind::Invalid {
                    ps.add_warning(ParseErrorKind::IllegalAttributePrefix, segs.first().unwrap().location());
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
                    AttrPrefixKind::Model => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Change => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Worklet => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Data => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Class => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Style => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Bind => AttrPrefixParseKind::Value,
                    AttrPrefixKind::MutBind => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Catch => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureBind => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureMutBind => AttrPrefixParseKind::Value,
                    AttrPrefixKind::CaptureCatch => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Mark => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Generic => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::ExtraAttr => AttrPrefixParseKind::Value,
                    AttrPrefixKind::SlotDataRef => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::Invalid => AttrPrefixParseKind::Value,
                };
                let value = if ps.peek_without_whitespace::<0>() == Some('=') {
                    if let Some(range) = ps.skip_whitespace() {
                        ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                    }
                    ps.next_with_whitespace(); // '='
                    match ps.peek_without_whitespace::<0>() {
                        None => {
                            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedWhitespace);
                            Some(Value::new_empty(ps.position()))
                        }
                        Some(ch) if ch == '"' || ch == '\'' => {
                            // parse as `"..."`
                            if let Some(range) = ps.skip_whitespace() {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            ps.next_with_whitespace(); // ch
                            let value = match &mut parse_kind {
                                AttrPrefixParseKind::Value => Value::parse_until_before(ps, ch),
                                AttrPrefixParseKind::StaticStr => {
                                    let value = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    if value.name.as_str().contains("{{") {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, value.location());
                                    }
                                    value
                                },
                                AttrPrefixParseKind::ScopeName => {
                                    let value = Name::parse_identifier_like_until_before(ps, |x| x == ch);
                                    let mut chars = value.name.chars();
                                    let first = chars.next();
                                    let invalid = match first {
                                        None => true,
                                        Some(ch) if !Name::is_start_char(ch) => true,
                                        Some(_) => {
                                            chars.find(|ch| !Name::is_following_char(*ch)).is_some()
                                        }
                                    };
                                    if invalid {
                                        ps.add_warning(ParseErrorKind::DataBindingNotAllowed, value.location());
                                    }
                                    value
                                },
                            };
                            ps.next_with_whitespace(); // ch
                            Some(value)
                        }
                        Some('{') if ps.peek_without_whitespace::<1>() == Some('{') => {
                            // parse `{{...}}`
                            if let Some(range) = ps.skip_whitespace() {
                                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                            }
                            let value = Value::parse_data_binding(ps)
                                .map(Value::from_expression);
                            if parse_kind != AttrPrefixParseKind::Value {
                                if let Some(value) = value.as_ref() {
                                    ps.add_warning(ParseErrorKind::DataBindingNotAllowed, value.location());
                                }
                            }
                            value
                        }
                        Some('>') | Some('/') => {
                            ps.add_warning_at_current_position(ParseErrorKind::MissingAttributeValue);
                            Some(Value::new_empty(ps.position()))
                        }
                        Some(_) => {
                            let value = Name::parse_identifier_like_until_before(ps, |x| char::is_whitespace(x));
                            Some(value)
                        }
                    }
                } else {
                    None
                };
                // TODO
            }
        }

        // end the start tag
        match ps.peek_without_whitespace() {
            None => {
                ps.add_warning(ParseErrorKind::IncompleteTag, start_angle_location);
                return this;
            }
            Some('/') => {
                ps.next_without_whitespace(); // '/'
                assert_eq!(ps.next_with_whitespace(), Some('>'));
                return this;
            }
            Some('>') => {
                ps.next_without_whitespace(); // '>'
            }
            _ => unreachable!()
        }

        // parse children
        let mut children = vec![];
        Node::parse_vec_node(ps, globals, &mut children);

        // parse end tag
        let found_end_tag = ps.try_parse(|ps| {
            if ps.peek_without_whitespace().is_none() {
                ps.add_warning(ParseErrorKind::MissingEndTag, start_angle_location);
                return None;
            }
            assert_eq!(ps.next_without_whitespace(), Some('<'));
            assert_eq!(ps.next_with_whitespace(), Some('/'));
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
                None
            } else {
                Some(end_tag_name)
            }
        }).is_some();
        if !found_end_tag {
            ps.add_warning(ParseErrorKind::MissingEndTag, tag_name.location);
        }

        this
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
    Change(Range<Position>),
    Worklet(Range<Position>),
    Data(Range<Position>),
}

#[derive(Debug, Clone)]
pub enum ClassAttribute {
    None,
    String(Value),
    Multiple(Attribute),
}

#[derive(Debug, Clone)]
pub enum StyleAttribute {
    None,
    String(Value),
    Multiple(Attribute),
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

    fn new_empty(pos: Position) -> Self {
        Self {
            name: CompactString::new_inline(""),
            location: pos..pos,
        }
    }

    fn parse_colon_separated(ps: &mut ParseState) -> Vec<Self> {
        let Some(peek) = ps.peek_with_whitespace::<0>() else {
            return Vec::with_capacity(0);
        };
        if !Self::is_start_char(peek) {
            return Vec::with_capacity(0);
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
        let expr = Expression::parse(ps);
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

use std::{collections::HashMap, ops::Range};

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
            let Some(peek) = ps.peek_n::<2>() else { return };
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
                    ps.next(); // '<'
                    ps.next(); // '!'
                    if ps.peek_n::<2>() == Some(['-', '-']) {
                        ps.next(); // '-'
                        ps.next(); // '-'
                        ps.skip_until_after("-->");
                    } else {
                        ps.skip_until_after(">");
                        ps.add_error(ParseErrorKind::UnrecognizedTag, start_pos..ps.position());
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
        generics: Vec<(Name, LitStr)>,
        extra_attr: Vec<(Name, LitStr)>,
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
        assert_eq!(ps.next(), Some('<'));
        let start_angle_location = start_angle_start..ps.position();
        let mut tag_name_slices = Name::parse_colon_separated(ps);
        assert_ne!(tag_name_slices.len(), 0);
        let tag_name = if tag_name_slices.len() > 1 {
            let end = tag_name_slices.pop().unwrap();
            for x in tag_name_slices {
                ps.add_warning(ParseErrorKind::IllegalNamePrefix, x.location());
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
                ps.add_error(ParseErrorKind::IllegalCharacter, pos..ps.position());
            } else if Name::is_start_char(peek) {
                // attribute name
                let segs = Name::parse_colon_separated(ps);
                let name = segs.pop().unwrap();
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
                }
                let prefix = match segs.pop() {
                    None => AttrPrefixKind::Normal,
                    Some("wx") => {
                        match name {
                            "if" => AttrPrefixKind::WxIf,
                            "for" => AttrPrefixKind::WxFor,
                            "for-index" => AttrPrefixKind::WxForIndex,
                            "for-item" => AttrPrefixKind::WxForItem,
                            "key" => AttrPrefixKind::WxKey,
                        }
                    }
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
                };
                if ps.peek_with_whitespace::<0>() == Some('=') {
                    let eq_pos = ps.position();
                    ps.next_with_whitespace(); // '='
                    let value = match ps.peek_with_whitespace::<0>() {
                        // TODO
                    }
                }
            }
        }

        // end the start tag
        match ps.peek() {
            None => {
                ps.add_error(ParseErrorKind::IncompleteTag, start_angle_location);
                return this;
            }
            Some('/') => {
                ps.next(); // '/'
                assert_eq!(ps.next(), Some('>'));
                return this;
            }
            Some('>') => {
                ps.next(); // '>'
            }
            _ => unreachable!()
        }

        // parse children
        let mut children = vec![];
        Node::parse_vec_node(ps, globals, &mut children);

        // parse end tag
        if ps.peek().is_none() {
            ps.add_error(ParseErrorKind::MissingEndTag, start_angle_location);
            return;
        }
        assert_eq!(ps.next(), Some('<'));
        assert_eq!(ps.next(), Some('/'));
        // TODO

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
        let peek = ps.peek_with_whitespace::<0>() else {
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
            let peek = ps.peek_with_whitespace() else { break };
            if !Self::is_following_char(peek) { break };
        }
        ret
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
                let expr = ps.try_parse(|ps| {
                    ps.next_with_whitespace(); // '{'
                    if ps.peek_with_whitespace() != Some('{') {
                        return None;
                    }
                    let expr = Expression::parse(ps);
                    ps.skip_whitespace();
                    let end_pos = ps.position();
                    match ps.skip_until_after("}}") {
                        None => {
                            ps.add_error(ParseErrorKind::MissingExpressionEnd, end_pos..ps.position());
                        }
                        Some(s) => {
                            if s.len() > 0 {
                                ps.add_error(ParseErrorKind::IllegalExpression, end_pos..ps.position());
                            }
                        }
                    }
                    Some(expr)
                });
                if let Some(expr) = expr {
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

            // try parse HTML entities
            if peek == '&' {
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
                    ret_value.push_str(&s);
                    ret_location.end = ps.position();
                    continue;
                }
            }

            // parse next char
            ret_value.push(ps.next_with_whitespace().unwrap());
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

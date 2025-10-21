use std::{borrow::Cow, ops::Range};

use compact_str::CompactString;

use crate::escape::dash_to_camel;

use super::{
    binding_map::{BindingMapCollector, BindingMapKeys},
    expr::Expression,
    ParseErrorKind, ParseState, Position, TemplateStructure,
};

pub const DEFAULT_FOR_ITEM_SCOPE_NAME: &'static str = "item";
pub const DEFAULT_FOR_INDEX_SCOPE_NAME: &'static str = "index";

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct Template {
    pub path: String,
    pub content: Vec<Node>,
    pub globals: TemplateGlobals,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct TemplateGlobals {
    pub imports: Vec<ImportElement>,
    pub includes: Vec<IncludeElement>,
    pub sub_templates: Vec<TemplateDefinition>,
    pub scripts: Vec<Script>,
    pub(crate) binding_map_collector: BindingMapCollector,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct ImportElement {
    pub tag_location: TagLocation,
    pub src_location: Range<Position>,
    pub src: StrName,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct IncludeElement {
    pub tag_location: TagLocation,
    pub src_location: Range<Position>,
    pub src: StrName,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct TemplateDefinition {
    pub tag_location: TagLocation,
    pub name_location: Range<Position>,
    pub name: StrName,
    pub content: Vec<Node>,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct TagLocation {
    pub start: (Range<Position>, Range<Position>),
    pub close: Range<Position>,
    pub end: Option<(Range<Position>, Range<Position>)>,
}

struct ScopeAnalyzeState {
    scopes: Vec<(CompactString, Range<Position>)>,
    inside_dynamic_tree: usize,
    binding_map_collector: BindingMapCollector,
}

impl Template {
    pub(super) fn parse(ps: &mut ParseState) -> Self {
        let mut globals = TemplateGlobals {
            imports: vec![],
            includes: vec![],
            sub_templates: vec![],
            scripts: vec![],
            binding_map_collector: BindingMapCollector::new(),
        };

        // 1st round: parse the string into AST
        let mut content = vec![];
        while !ps.ended() {
            Node::parse_vec_node(ps, &mut globals, &mut content);
            if ps.peek_str("</") {
                let pos = ps.position();
                ps.skip_until_after(">");
                ps.add_warning(ParseErrorKind::InvalidEndTag, pos..ps.position());
            }
        }

        // 2nd round: traverse tree to alternate some details
        for sub in globals.sub_templates.iter_mut() {
            let mut sas = ScopeAnalyzeState {
                scopes: globals
                    .scripts
                    .iter()
                    .map(|x| {
                        let name = x.module_name();
                        (name.name.clone(), name.location())
                    })
                    .collect(),
                inside_dynamic_tree: 1,
                binding_map_collector: BindingMapCollector::new(),
            };
            for node in &mut sub.content {
                node.init_scopes_and_binding_map_keys(ps, &mut sas);
            }
        }
        let mut sas = ScopeAnalyzeState {
            scopes: globals
                .scripts
                .iter()
                .map(|x| {
                    let name = x.module_name();
                    (name.name.clone(), name.location())
                })
                .collect(),
            inside_dynamic_tree: 0,
            binding_map_collector: BindingMapCollector::new(),
        };
        for node in &mut content {
            node.init_scopes_and_binding_map_keys(ps, &mut sas);
        }
        globals.binding_map_collector = sas.binding_map_collector;

        Template {
            path: ps.path.to_string(),
            content,
            globals,
        }
    }

    pub fn global_scopes(&self) -> Vec<&StrName> {
        self.globals
            .scripts
            .iter()
            .map(|x| x.module_name())
            .collect()
    }

    pub fn direct_dependencies<'a>(&'a self) -> impl Iterator<Item = String> + 'a {
        let imports = self
            .globals
            .imports
            .iter()
            .map(move |p| crate::path::resolve(&self.path, &p.src.name));
        let includes = self
            .globals
            .includes
            .iter()
            .map(move |p| crate::path::resolve(&self.path, &p.src.name));
        imports.chain(includes)
    }

    pub fn script_dependencies<'a>(&'a self) -> impl Iterator<Item = String> + 'a {
        self.globals
            .scripts
            .iter()
            .filter_map(move |script| match script {
                Script::GlobalRef { src, .. } => {
                    let abs_path = crate::path::resolve(&self.path, &src.name);
                    Some(abs_path)
                }
                Script::Inline { .. } => None,
            })
    }

    pub fn inline_script_module_names<'a>(&'a self) -> impl Iterator<Item = &'a str> {
        self.globals
            .scripts
            .iter()
            .filter_map(move |script| match script {
                Script::GlobalRef { .. } => None,
                Script::Inline { module_name, .. } => Some(module_name.name.as_str()),
            })
    }

    pub fn inline_script_content(&self, module_name: &str) -> Option<&str> {
        for script in self.globals.scripts.iter() {
            match script {
                Script::GlobalRef { .. } => {}
                Script::Inline {
                    tag_location: _,
                    module_location: _,
                    module_name: m,
                    content,
                    content_location: _,
                } => {
                    if module_name == m.name.as_str() {
                        return Some(&content);
                    }
                }
            }
        }
        None
    }

    pub fn inline_script_start_line(&self, module_name: &str) -> Option<u32> {
        for script in self.globals.scripts.iter() {
            match script {
                Script::GlobalRef { .. } => {}
                Script::Inline {
                    tag_location: _,
                    module_location: _,
                    module_name: m,
                    content: _,
                    content_location,
                } => {
                    if module_name == m.name.as_str() {
                        return Some(content_location.start.line);
                    }
                }
            }
        }
        None
    }

    pub fn set_inline_script_content(&mut self, module_name: &str, new_content: &str) {
        let null_location = Position {
            line: 0,
            utf16_col: 0,
        }..Position {
            line: 0,
            utf16_col: 0,
        };
        match self.globals.scripts.iter_mut().find(|script| match script {
            Script::GlobalRef { .. } => false,
            Script::Inline { module_name: m, .. } => module_name == m.name.as_str(),
        }) {
            Some(script) => {
                *script = Script::Inline {
                    tag_location: script.tag_location(),
                    module_location: script.module_location(),
                    module_name: script.module_name().clone(),
                    content: new_content.to_string(),
                    content_location: null_location,
                };
            }
            None => self.globals.scripts.push(Script::Inline {
                tag_location: TagLocation {
                    start: (null_location.clone(), null_location.clone()),
                    close: null_location.clone(),
                    end: None,
                },
                module_location: null_location.clone(),
                module_name: StrName {
                    name: CompactString::new(module_name),
                    location: null_location.clone(),
                },
                content: String::from(new_content),
                content_location: null_location,
            }),
        }
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Node {
    Text(Value),
    Element(Element),
    Comment(Comment),
    UnknownMetaTag(UnknownMetaTag),
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct Comment {
    pub content: String,
    pub location: Range<Position>,
}

impl Comment {
    pub fn new(content: &str, location: Range<Position>) -> Self {
        Self {
            content: content.to_string(),
            location,
        }
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct UnknownMetaTag {
    pub tag_name: Vec<Ident>,
    pub attributes: Vec<CustomAttribute>,
    pub location: Range<Position>,
}

impl TemplateStructure for Node {
    fn location(&self) -> std::ops::Range<Position> {
        match self {
            Self::Text(x) => x.location(),
            Self::Element(x) => x.location(),
            Self::Comment(x) => x.location.clone(),
            Self::UnknownMetaTag(x) => x.location.clone(),
        }
    }
}

impl Node {
    fn parse_vec_node(ps: &mut ParseState, globals: &mut TemplateGlobals, ret: &mut Vec<Node>) {
        loop {
            if ps.ended() || ps.peek_str("</") {
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
                    ret.push(Node::Comment(Comment {
                        content: s.to_string(),
                        location,
                    }));
                } else {
                    let is_meta = if let Some(peek) = ps.peek::<0>() {
                        Ident::is_start_char(peek)
                    } else {
                        false
                    };
                    if is_meta {
                        let tag_name = Ident::parse_colon_separated(ps);
                        let attributes = CustomAttribute::parse_until_tag_end(ps);
                        if ps.consume_str(">").is_none() {
                            ps.add_warning(ParseErrorKind::IncompleteTag, range.clone());
                        }
                        let location = range.start..ps.position();
                        ps.add_warning(ParseErrorKind::UnknownMetaTag, location.clone());
                        ret.push(Node::UnknownMetaTag(UnknownMetaTag {
                            tag_name,
                            attributes,
                            location,
                        }));
                    }
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
                if ps.peek::<0>() != Some('<') {
                    return false;
                }
                let Some(ch) = ps.peek::<1>() else {
                    return false;
                };
                if ch == '/' || ch == '!' || Ident::is_start_char(ch) {
                    return true;
                }
                false
            });
            let is_whitespace = match &value {
                Value::Static { value, .. } => {
                    value.trim_matches(super::is_template_whitespace).is_empty()
                }
                Value::Dynamic { .. } => false,
            };
            if !is_whitespace {
                ret.push(Node::Text(value));
            }
        }
    }

    fn init_scopes_and_binding_map_keys(
        &mut self,
        ps: &mut ParseState,
        sas: &mut ScopeAnalyzeState,
    ) {
        match self {
            Self::Text(value) => {
                value.init_scopes_and_binding_map_keys(sas, false);
            }
            Self::Element(x) => {
                x.init_scopes_and_binding_map_keys(ps, sas);
            }
            Self::Comment(..) | Self::UnknownMetaTag(..) => {}
        }
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct Element {
    pub kind: ElementKind,
    pub tag_location: TagLocation,
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum ElementKind {
    #[non_exhaustive]
    Normal {
        tag_name: Ident,
        attributes: Vec<NormalAttribute>,
        class: ClassAttribute,
        style: StyleAttribute,
        change_attributes: Vec<Attribute>,
        worklet_attributes: Vec<StaticAttribute>,
        children: Vec<Node>,
        generics: Vec<StaticAttribute>,
        extra_attr: Vec<StaticAttribute>,
        let_vars: Vec<Attribute>,
        common: CommonElementAttributes,
    },
    #[non_exhaustive]
    Pure {
        children: Vec<Node>,
        let_vars: Vec<Attribute>,
        slot: Option<(Range<Position>, Value)>,
        slot_value_refs: Vec<StaticAttribute>,
    },
    #[non_exhaustive]
    For {
        list: (Range<Position>, Value),
        item_name: (Range<Position>, StrName),
        index_name: (Range<Position>, StrName),
        key: (Range<Position>, StrName),
        children: Vec<Node>,
    },
    #[non_exhaustive]
    If {
        branches: Vec<(Range<Position>, Value, Vec<Node>)>,
        else_branch: Option<(Range<Position>, Vec<Node>)>,
    },
    #[non_exhaustive]
    TemplateRef {
        target: (Range<Position>, Value),
        data: (Range<Position>, Value),
    },
    #[non_exhaustive]
    Include { path: (Range<Position>, StrName) },
    #[non_exhaustive]
    Slot {
        name: (Range<Position>, Value),
        values: Vec<Attribute>,
        common: CommonElementAttributes,
    },
}

impl TemplateStructure for Element {
    fn location(&self) -> std::ops::Range<Position> {
        match self.tag_location.end.as_ref() {
            None => self.tag_location.start.0.start..self.tag_location.start.1.end,
            Some((_, x)) => self.tag_location.start.0.start..x.end,
        }
    }
}

impl Element {
    pub fn introduced_scopes(&self) -> Vec<&StrName> {
        match &self.kind {
            ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                common.slot_value_refs.iter().map(|x| &x.value).collect()
            }
            ElementKind::Pure {
                slot_value_refs, ..
            } => slot_value_refs.iter().map(|x| &x.value).collect(),
            ElementKind::For {
                item_name,
                index_name,
                ..
            } => {
                vec![&item_name.1, &index_name.1]
            }
            ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. } => vec![],
        }
    }

    pub(crate) fn children(&self) -> Option<&Vec<Node>> {
        match &self.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => Some(children),
            ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => None,
        }
    }

    pub(crate) fn children_mut(&mut self) -> Option<&mut Vec<Node>> {
        match &mut self.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => Some(children),
            ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => None,
        }
    }

    pub fn iter_children(&self) -> super::iter::ChildrenIter {
        super::iter::ChildrenIter::new(self)
    }

    pub fn iter_children_mut(&mut self) -> super::iter::ChildrenIterMut {
        super::iter::ChildrenIterMut::new(self)
    }

    pub fn slot_value_refs(&self) -> Option<impl Iterator<Item = &StaticAttribute>> {
        match &self.kind {
            ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                Some(common.slot_value_refs.iter())
            }
            ElementKind::Pure {
                slot_value_refs, ..
            } => Some(slot_value_refs.iter()),
            ElementKind::For { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. } => None,
        }
    }

    pub fn let_var_refs(&self) -> Option<impl Iterator<Item = &Attribute>> {
        match &self.kind {
            ElementKind::Normal { let_vars, .. } | ElementKind::Pure { let_vars, .. } => {
                Some(let_vars.iter())
            }
            ElementKind::Slot { .. }
            | ElementKind::For { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. } => None,
        }
    }

    pub fn let_var_refs_mut(&mut self) -> Option<impl Iterator<Item = &mut Attribute>> {
        match &mut self.kind {
            ElementKind::Normal { let_vars, .. } | ElementKind::Pure { let_vars, .. } => {
                Some(let_vars.iter_mut())
            }
            ElementKind::Slot { .. }
            | ElementKind::For { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. } => None,
        }
    }

    fn for_each_value_mut(&mut self, mut f: impl FnMut(&mut Value, bool)) {
        match &mut self.kind {
            ElementKind::Normal {
                tag_name: _,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes: _,
                children: _,
                generics: _,
                extra_attr: _,
                let_vars,
                common,
            } => {
                for attr in let_vars {
                    if let Some(value) = attr.value.as_mut() {
                        f(value, false);
                    }
                }
                for attr in attributes {
                    if let Some(value) = attr.value.as_mut() {
                        f(value, false);
                    }
                }
                match class {
                    ClassAttribute::None => {}
                    ClassAttribute::String(_, value) => {
                        f(value, false);
                    }
                    ClassAttribute::Multiple(x) => {
                        for (_, _, value) in x {
                            if let Some(value) = value.as_mut() {
                                f(value, false);
                            }
                        }
                    }
                }
                match style {
                    StyleAttribute::None => {}
                    StyleAttribute::String(_, value) => {
                        f(value, false);
                    }
                    StyleAttribute::Multiple(x) => {
                        for (_, _, value) in x {
                            f(value, false);
                        }
                    }
                }
                for attr in change_attributes {
                    if let Some(value) = attr.value.as_mut() {
                        f(value, false);
                    }
                }
                common.for_each_value_mut(f);
            }
            ElementKind::Pure {
                children: _,
                let_vars,
                slot,
                slot_value_refs: _,
            } => {
                for attr in let_vars {
                    if let Some(value) = attr.value.as_mut() {
                        f(value, false);
                    }
                }
                if let Some(slot) = slot {
                    f(&mut slot.1, true);
                }
            }
            ElementKind::For {
                list,
                item_name: _,
                index_name: _,
                key: _,
                children: _,
            } => {
                f(&mut list.1, true);
            }
            ElementKind::If {
                branches,
                else_branch: _,
            } => {
                for (_, value, _) in branches {
                    f(value, true);
                }
            }
            ElementKind::TemplateRef { target, data } => {
                f(&mut target.1, true);
                f(&mut data.1, true);
            }
            ElementKind::Slot {
                name,
                values,
                common,
            } => {
                f(&mut name.1, true);
                for attr in values {
                    if let Some(value) = attr.value.as_mut() {
                        f(value, true);
                    }
                }
                common.for_each_value_mut(f);
            }
            ElementKind::Include { path: _ } => {}
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
        if tag_name.has_uppercase() {
            ps.add_warning(ParseErrorKind::AvoidUppercaseLetters, tag_name.location());
        }

        // create an empty element
        let default_attr_position = tag_name.location.end;
        let tag_name_str = tag_name.name.as_str();
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        enum ExternalTagKind {
            Include,
            Import,
            Script,
        }
        let external_tag_type = match tag_name_str {
            "import" => ExternalTagKind::Import,
            "wxs" => ExternalTagKind::Script,
            _ => ExternalTagKind::Include,
        };
        let mut element = match tag_name_str {
            "block" => ElementKind::Pure {
                children: vec![],
                let_vars: vec![],
                slot: None,
                slot_value_refs: vec![],
            },
            "template" => {
                // firstly parse `<template name>` as `<template is>` and collect attributes
                ElementKind::TemplateRef {
                    target: (
                        default_attr_position..default_attr_position,
                        Value::new_empty(default_attr_position),
                    ),
                    data: (
                        default_attr_position..default_attr_position,
                        Value::new_empty(default_attr_position),
                    ),
                }
            }
            "include" | "wxs" | "import" => {
                // firstly parse all these as `<include>` and collect attributes
                ElementKind::Include {
                    path: (
                        default_attr_position..default_attr_position,
                        StrName::new_empty(default_attr_position),
                    ),
                }
            }
            "slot" => ElementKind::Slot {
                name: (
                    default_attr_position..default_attr_position,
                    Value::new_empty(default_attr_position),
                ),
                values: vec![],
                common: Default::default(),
            },
            _ => ElementKind::Normal {
                tag_name: tag_name.clone(),
                attributes: vec![],
                class: ClassAttribute::None,
                style: StyleAttribute::None,
                change_attributes: vec![],
                worklet_attributes: vec![],
                children: vec![],
                generics: vec![],
                extra_attr: vec![],
                let_vars: vec![],
                common: Default::default(),
            },
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
        let mut class_attrs: Vec<(Range<Position>, Ident, Option<Value>)> = vec![];
        let mut style_attrs: Vec<(Range<Position>, Ident, Value)> = vec![];
        loop {
            ps.skip_whitespace();
            let Some(peek) = ps.peek::<0>() else { break };
            if peek == '>' {
                break;
            }
            if peek == '/' {
                // maybe self-close
                if !ps.peek_str("/>") {
                    let location = ps.consume_str("/").unwrap();
                    ps.add_warning(ParseErrorKind::UnexpectedCharacter, location);
                } else {
                    break;
                }
            } else if Ident::is_start_char(peek) {
                // decide the attribute kind
                enum AttrPrefixKind {
                    Normal,
                    Id,
                    Slot,
                    ClassString,
                    StyleString,
                    WxIf(Range<Position>),
                    WxElif(Range<Position>),
                    WxElse(Range<Position>),
                    WxFor(Range<Position>),
                    WxForIndex(Range<Position>),
                    WxForItem(Range<Position>),
                    WxKey(Range<Position>),
                    TemplateName,
                    TemplateIs,
                    TemplateData,
                    Src(&'static str),
                    Module,
                    SlotName,
                    Model(Range<Position>),
                    Change(Range<Position>),
                    Worklet(Range<Position>),
                    Data(Range<Position>),
                    DataHyphen,
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
                    LetVar(Range<Position>),
                    Invalid(Range<Position>),
                }
                let mut segs = Ident::parse_colon_separated(ps);
                let attr_name = segs.pop().unwrap();
                let prefix = if segs.len() <= 1 && attr_name.name.len() > 0 {
                    match segs.first() {
                        None => match (&element, attr_name.name.as_str()) {
                            (ElementKind::TemplateRef { .. }, "name") => {
                                AttrPrefixKind::TemplateName
                            }
                            (ElementKind::TemplateRef { .. }, "is") => AttrPrefixKind::TemplateIs,
                            (ElementKind::TemplateRef { .. }, "data") => {
                                AttrPrefixKind::TemplateData
                            }
                            (ElementKind::Include { .. }, "src") => {
                                let suffix = match external_tag_type {
                                    ExternalTagKind::Include | ExternalTagKind::Import => ".wxml",
                                    ExternalTagKind::Script => ".wxs",
                                };
                                AttrPrefixKind::Src(suffix)
                            }
                            (ElementKind::Include { .. }, "module") => match external_tag_type {
                                ExternalTagKind::Include | ExternalTagKind::Import => {
                                    AttrPrefixKind::Normal
                                }
                                ExternalTagKind::Script => AttrPrefixKind::Module,
                            },
                            (ElementKind::Slot { .. }, "name") => AttrPrefixKind::SlotName,
                            (_, "id") => AttrPrefixKind::Id,
                            (_, "slot") => AttrPrefixKind::Slot,
                            (ElementKind::Normal { .. }, "class") => AttrPrefixKind::ClassString,
                            (ElementKind::Normal { .. }, "style") => AttrPrefixKind::StyleString,
                            (ElementKind::Normal { .. }, x) | (ElementKind::Slot { .. }, x)
                                if x.starts_with("data-") && x != "data-" =>
                            {
                                AttrPrefixKind::DataHyphen
                            }
                            _ => AttrPrefixKind::Normal,
                        },
                        Some(x) => match x.name.as_str() {
                            "wx" => match attr_name.name.as_str() {
                                "if" => AttrPrefixKind::WxIf(x.location()),
                                "elif" => AttrPrefixKind::WxElif(x.location()),
                                "else" => AttrPrefixKind::WxElse(x.location()),
                                "for" => AttrPrefixKind::WxFor(x.location()),
                                "for-index" => AttrPrefixKind::WxForIndex(x.location()),
                                "for-item" => AttrPrefixKind::WxForItem(x.location()),
                                "for-items" => {
                                    ps.add_warning(
                                        ParseErrorKind::DeprecatedAttribute,
                                        x.location(),
                                    );
                                    AttrPrefixKind::WxFor(x.location())
                                }
                                "key" => AttrPrefixKind::WxKey(x.location()),
                                _ => AttrPrefixKind::Invalid(segs.first().unwrap().location()),
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
                            "let" => AttrPrefixKind::LetVar(x.location()),
                            _ => AttrPrefixKind::Invalid(x.location()),
                        },
                    }
                } else {
                    AttrPrefixKind::Invalid(segs.first().unwrap().location())
                };
                if let AttrPrefixKind::Invalid(location) = &prefix {
                    ps.add_warning(ParseErrorKind::InvalidAttributePrefix, location.clone());
                }
                #[derive(Debug, PartialEq)]
                enum AttrPrefixParseKind {
                    Value,
                    TemplateData,
                    StaticStr,
                    ScopeName,
                }
                let parse_kind = match prefix {
                    AttrPrefixKind::Normal => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Id => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Slot => AttrPrefixParseKind::Value,
                    AttrPrefixKind::ClassString => AttrPrefixParseKind::Value,
                    AttrPrefixKind::StyleString => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxIf(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxElif(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxElse(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::WxFor(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::WxForIndex(_) => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::WxForItem(_) => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::WxKey(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::TemplateName => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::TemplateIs => AttrPrefixParseKind::Value,
                    AttrPrefixKind::TemplateData => AttrPrefixParseKind::TemplateData,
                    AttrPrefixKind::Src(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::Module => AttrPrefixParseKind::ScopeName,
                    AttrPrefixKind::SlotName => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Model(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Change(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Worklet(_) => AttrPrefixParseKind::StaticStr,
                    AttrPrefixKind::Data(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::DataHyphen => AttrPrefixParseKind::Value,
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
                    AttrPrefixKind::LetVar(_) => AttrPrefixParseKind::Value,
                    AttrPrefixKind::Invalid(_) => AttrPrefixParseKind::Value,
                };

                // dash to camel case conversion for attribute name
                let attr_name = match &prefix {
                    AttrPrefixKind::Model(_)
                    | AttrPrefixKind::Change(_)
                    | AttrPrefixKind::Worklet(_)
                    | AttrPrefixKind::SlotDataRef(_)
                    | AttrPrefixKind::LetVar(_) => Ident {
                        name: dash_to_camel(&attr_name.name),
                        location: attr_name.location,
                    },
                    AttrPrefixKind::Normal => {
                        if let ElementKind::Slot { .. } = element {
                            Ident {
                                name: dash_to_camel(&attr_name.name),
                                location: attr_name.location,
                            }
                        } else {
                            attr_name
                        }
                    }
                    AttrPrefixKind::DataHyphen => {
                        let n = Ident {
                            name: attr_name.name.strip_prefix("data-").unwrap().into(),
                            location: attr_name.location(),
                        };
                        let n = if n.has_uppercase() {
                            ps.add_warning(ParseErrorKind::AvoidUppercaseLetters, n.location());
                            n.name.to_ascii_lowercase().into()
                        } else {
                            n.name
                        };
                        Ident {
                            name: dash_to_camel(&n.to_ascii_lowercase()),
                            location: attr_name.location,
                        }
                    }
                    _ => attr_name,
                };

                // actually parse the value
                enum AttrPrefixParseResult {
                    Invalid,
                    Value(Option<Value>),
                    StaticStr(StrName),
                    ScopeName(StrName),
                }
                let attr_value = match parse_kind {
                    AttrPrefixParseKind::Value => {
                        if let Some(attr) = Attribute::parse_optional_value(ps, attr_name.clone()) {
                            AttrPrefixParseResult::Value(attr.value)
                        } else {
                            AttrPrefixParseResult::Invalid
                        }
                    }
                    AttrPrefixParseKind::TemplateData => {
                        if let Some(attr) =
                            Attribute::parse_optional_value_as_object(ps, attr_name.clone())
                        {
                            AttrPrefixParseResult::Value(attr.value)
                        } else {
                            AttrPrefixParseResult::Invalid
                        }
                    }
                    AttrPrefixParseKind::StaticStr => {
                        if let Some(attr) =
                            StaticAttribute::parse_optional_value(ps, attr_name.clone())
                        {
                            if attr.value.name.as_str().contains("{{") {
                                ps.add_warning(
                                    ParseErrorKind::DataBindingNotAllowed,
                                    attr.value.location(),
                                );
                            }
                            AttrPrefixParseResult::StaticStr(attr.value)
                        } else {
                            AttrPrefixParseResult::Invalid
                        }
                    }
                    AttrPrefixParseKind::ScopeName => {
                        if let Some(attr) =
                            StaticAttribute::parse_optional_value(ps, attr_name.clone())
                        {
                            AttrPrefixParseResult::ScopeName(attr.value)
                        } else {
                            AttrPrefixParseResult::Invalid
                        }
                    }
                };

                // unwrap an optional value
                fn unwrap_option_value_for_attr(
                    ps: &mut ParseState,
                    value: Option<Value>,
                    attr_name: &Ident,
                ) -> Value {
                    match value {
                        Some(value) => value,
                        None => {
                            ps.add_warning(
                                ParseErrorKind::MissingAttributeValue,
                                attr_name.location.clone(),
                            );
                            Value::new_empty(attr_name.location.end)
                        }
                    }
                }

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
                        ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                common.event_bindings.push(EventBinding {
                                    name: attr_name,
                                    value,
                                    is_catch,
                                    is_mut,
                                    is_capture,
                                    prefix_location,
                                });
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    }
                }
                match prefix {
                    AttrPrefixKind::Normal => match &mut element {
                        ElementKind::Normal { attributes, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if attributes
                                    .iter()
                                    .find(|x| x.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let attr = NormalAttribute {
                                        name: attr_name,
                                        value,
                                        prefix: NormalAttributePrefix::None,
                                    };
                                    attributes.push(attr);
                                }
                            }
                        }
                        ElementKind::Slot {
                            values: attributes, ..
                        } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if attributes
                                    .iter()
                                    .find(|x| x.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let attr = Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: None,
                                    };
                                    attributes.push(attr);
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Id => match &mut element {
                        ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if common.id.is_some() {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    common.id = Some((attr_name.location(), value));
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Slot => match &mut element {
                        ElementKind::Normal {
                            common: CommonElementAttributes { slot, .. },
                            ..
                        }
                        | ElementKind::Pure { slot, .. }
                        | ElementKind::Slot {
                            common: CommonElementAttributes { slot, .. },
                            ..
                        } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if slot.is_some() {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *slot = Some((attr_name.location(), value));
                                }
                            }
                        }
                        ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::ClassString => match &mut element {
                        ElementKind::Normal { class, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if let ClassAttribute::Multiple(..) | ClassAttribute::String(..) =
                                    class
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *class = ClassAttribute::String(attr_name.location(), value);
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. }
                        | ElementKind::Slot { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::StyleString => match &mut element {
                        ElementKind::Normal { style, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if let StyleAttribute::Multiple(..) | StyleAttribute::String(..) =
                                    style
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *style = StyleAttribute::String(attr_name.location(), value);
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. }
                        | ElementKind::Slot { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::WxIf(prefix_location) => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_if.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_if = Some((loc, value));
                            }
                        }
                    }
                    AttrPrefixKind::WxElif(prefix_location) => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_elif.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_elif = Some((loc, value));
                            }
                        }
                    }
                    AttrPrefixKind::WxElse(prefix_location) => {
                        if let AttrPrefixParseResult::StaticStr(value) = attr_value {
                            if wx_else.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location(),
                                );
                            } else {
                                if value.name.len() > 0 {
                                    ps.add_warning(
                                        ParseErrorKind::InvalidAttributeValue,
                                        value.location(),
                                    );
                                }
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_else = Some(loc);
                            }
                        }
                    }
                    AttrPrefixKind::WxFor(prefix_location) => {
                        if let AttrPrefixParseResult::Value(value) = attr_value {
                            if wx_for.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_for = Some((loc, value));
                            }
                        }
                    }
                    AttrPrefixKind::WxForIndex(prefix_location) => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_index.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                if !s.is_valid_js_identifier() {
                                    ps.add_warning(ParseErrorKind::InvalidScopeName, s.location());
                                }
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_for_index = Some((loc, s));
                            }
                        }
                    }
                    AttrPrefixKind::WxForItem(prefix_location) => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if wx_for_item.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                if !s.is_valid_js_identifier() {
                                    ps.add_warning(ParseErrorKind::InvalidScopeName, s.location());
                                }
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_for_item = Some((loc, s));
                            }
                        }
                    }
                    AttrPrefixKind::WxKey(prefix_location) => {
                        if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                            if wx_key.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                let loc = prefix_location.start..attr_name.location().end;
                                wx_key = Some((loc, s));
                            }
                        }
                    }
                    AttrPrefixKind::TemplateName => {
                        if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                            if template_name.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::DuplicatedAttribute,
                                    attr_name.location,
                                );
                            } else {
                                template_name = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::TemplateIs => match &mut element {
                        ElementKind::TemplateRef { target, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if target.1.location().end != default_attr_position {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *target = (attr_name.location(), value);
                                }
                            }
                        }
                        _ => unreachable!(),
                    },
                    AttrPrefixKind::TemplateData => match &mut element {
                        ElementKind::TemplateRef { data, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if data.1.location().end != default_attr_position {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *data = (attr_name.location(), value);
                                }
                            }
                        }
                        _ => unreachable!(),
                    },
                    AttrPrefixKind::Src(suffix) => match &mut element {
                        ElementKind::Include { path, .. } => {
                            if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                if path.1.location().end != default_attr_position {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let name = s
                                        .name
                                        .strip_suffix(suffix)
                                        .unwrap_or(s.name.as_str())
                                        .into();
                                    let s = StrName {
                                        name,
                                        location: s.location,
                                    };
                                    *path = (attr_name.location(), s);
                                }
                            }
                        }
                        _ => unreachable!(),
                    },
                    AttrPrefixKind::Module => {
                        if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                            if script_module.is_some() {
                                ps.add_warning(
                                    ParseErrorKind::InvalidAttribute,
                                    attr_name.location,
                                );
                            } else {
                                if !s.is_valid_js_identifier() {
                                    ps.add_warning(ParseErrorKind::InvalidScopeName, s.location());
                                }
                                script_module = Some((attr_name.location(), s));
                            }
                        }
                    }
                    AttrPrefixKind::SlotName => match &mut element {
                        ElementKind::Slot { name, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if name.1.location().end != default_attr_position {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    *name = (attr_name.location(), value);
                                }
                            }
                        }
                        _ => unreachable!(),
                    },
                    AttrPrefixKind::Model(prefix_location) => match &mut element {
                        ElementKind::Normal { attributes, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if attributes
                                    .iter()
                                    .find(|x| x.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let attr = NormalAttribute {
                                        name: attr_name,
                                        value,
                                        prefix: NormalAttributePrefix::Model(prefix_location),
                                    };
                                    attributes.push(attr);
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Change(prefix_location) => match &mut element {
                        ElementKind::Normal {
                            change_attributes, ..
                        } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if change_attributes
                                    .iter()
                                    .find(|x| x.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    if value.is_none() {
                                        ps.add_warning(
                                            ParseErrorKind::MissingAttributeValue,
                                            attr_name.location.clone(),
                                        );
                                    }
                                    change_attributes.push(Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Worklet(prefix_location) => match &mut element {
                        ElementKind::Normal {
                            worklet_attributes, ..
                        } => {
                            if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                if worklet_attributes
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    worklet_attributes.push(StaticAttribute {
                                        name: attr_name,
                                        value: s,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Data(prefix_location) => match &mut element {
                        ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if common
                                    .data
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    common.data.push(Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::DataHyphen => match &mut element {
                        ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if common
                                    .data
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    common.data.push(Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: None,
                                    });
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Class(prefix_location) => match &mut element {
                        ElementKind::Normal { .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if class_attrs
                                    .iter()
                                    .find(|(_, x, _)| x.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    class_attrs.push((prefix_location, attr_name, value));
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Style(prefix_location) => match &mut element {
                        ElementKind::Normal { .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if style_attrs
                                    .iter()
                                    .find(|(_, x, _)| x.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let value = unwrap_option_value_for_attr(ps, value, &attr_name);
                                    style_attrs.push((prefix_location, attr_name, value));
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Bind(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            false,
                            false,
                            false,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::MutBind(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            false,
                            true,
                            false,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::Catch(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            true,
                            false,
                            false,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::CaptureBind(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            false,
                            false,
                            true,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::CaptureMutBind(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            false,
                            true,
                            true,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::CaptureCatch(prefix_location) => {
                        add_element_event_binding(
                            ps,
                            &mut element,
                            attr_name,
                            attr_value,
                            true,
                            false,
                            true,
                            prefix_location,
                        );
                    }
                    AttrPrefixKind::Mark(prefix_location) => match &mut element {
                        ElementKind::Normal { common, .. } | ElementKind::Slot { common, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if common
                                    .marks
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    common.marks.push(Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Generic(prefix_location) => match &mut element {
                        ElementKind::Normal { generics, .. } => {
                            if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                if generics
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    generics.push(StaticAttribute {
                                        name: attr_name,
                                        value: s,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::ExtraAttr(prefix_location) => match &mut element {
                        ElementKind::Normal { extra_attr, .. } => {
                            if let AttrPrefixParseResult::StaticStr(s) = attr_value {
                                if extra_attr
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    extra_attr.push(StaticAttribute {
                                        name: attr_name,
                                        value: s,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::Pure { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::SlotDataRef(prefix_location) => match &mut element {
                        ElementKind::Normal {
                            common:
                                CommonElementAttributes {
                                    slot_value_refs, ..
                                },
                            ..
                        }
                        | ElementKind::Pure {
                            slot_value_refs, ..
                        }
                        | ElementKind::Slot {
                            common:
                                CommonElementAttributes {
                                    slot_value_refs, ..
                                },
                            ..
                        } => {
                            if let AttrPrefixParseResult::ScopeName(s) = attr_value {
                                if slot_value_refs
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    let s = match s.name.is_empty() {
                                        true => StrName {
                                            name: attr_name.name.clone(),
                                            location: attr_name.location(),
                                        },
                                        false => s,
                                    };
                                    if !s.is_valid_js_identifier() {
                                        ps.add_warning(
                                            ParseErrorKind::InvalidScopeName,
                                            s.location(),
                                        );
                                    }
                                    slot_value_refs.push(StaticAttribute {
                                        name: attr_name,
                                        value: s,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::LetVar(prefix_location) => match &mut element {
                        ElementKind::Normal { let_vars, .. }
                        | ElementKind::Pure { let_vars, .. } => {
                            if let AttrPrefixParseResult::Value(value) = attr_value {
                                if let_vars
                                    .iter()
                                    .find(|attr| attr.name.name_eq(&attr_name))
                                    .is_some()
                                {
                                    ps.add_warning(
                                        ParseErrorKind::DuplicatedAttribute,
                                        attr_name.location,
                                    );
                                } else {
                                    if value.is_none() {
                                        ps.add_warning(
                                            ParseErrorKind::MissingAttributeValue,
                                            attr_name.location.clone(),
                                        );
                                    }
                                    let_vars.push(Attribute {
                                        name: attr_name,
                                        value,
                                        prefix_location: Some(prefix_location),
                                    });
                                }
                            }
                        }
                        ElementKind::Slot { .. }
                        | ElementKind::For { .. }
                        | ElementKind::If { .. }
                        | ElementKind::TemplateRef { .. }
                        | ElementKind::Include { .. } => {
                            ps.add_warning(ParseErrorKind::InvalidAttribute, attr_name.location);
                        }
                    },
                    AttrPrefixKind::Invalid(_) => {}
                }
            } else {
                let pos = ps.position();
                loop {
                    let Some(peek) = ps.peek::<0>() else { break };
                    if peek == '/'
                        || peek == '>'
                        || Ident::is_start_char(peek)
                        || char::is_whitespace(peek)
                    {
                        break;
                    }
                    ps.next();
                }
                ps.add_warning(ParseErrorKind::InvalidAttributeName, pos..ps.position());
            }
        }

        // end the start tag
        let (self_close_location, start_tag_end_location) = match ps.peek::<0>() {
            None => {
                ps.add_warning(
                    ParseErrorKind::IncompleteTag,
                    start_tag_start_location.clone(),
                );
                let pos = ps.position();
                (Some(pos..pos), pos..pos)
            }
            Some('/') => {
                let close_location = ps.consume_str("/").unwrap();
                let start_tag_end_location = ps.consume_str(">").unwrap();
                (Some(close_location), start_tag_end_location)
            }
            Some('>') => (None, ps.consume_str(">").unwrap()),
            _ => unreachable!(),
        };

        // validate class attributes
        if !class_attrs.is_empty() {
            match &mut element {
                ElementKind::Normal { class, .. } => {
                    match class {
                        ClassAttribute::None => {}
                        ClassAttribute::String(name_location, value) => match value {
                            Value::Static { value, location } => {
                                let mut classes: Vec<Ident> = vec![];
                                for item in value.split_whitespace() {
                                    let str_name = StrName {
                                        name: item.into(),
                                        location: location.clone(),
                                    };
                                    let Some(ident) = str_name.to_css_compatible_ident() else {
                                        classes.clear();
                                        ps.add_warning(
                                            ParseErrorKind::InvalidClassNames,
                                            str_name.location,
                                        );
                                        break;
                                    };
                                    if class_attrs.iter().find(|x| x.1.name_eq(&ident)).is_some()
                                        || classes.iter().find(|x| x.name_eq(&ident)).is_some()
                                    {
                                        classes.clear();
                                        ps.add_warning(
                                            ParseErrorKind::DuplicatedClassNames,
                                            str_name.location,
                                        );
                                        break;
                                    }
                                    classes.push(ident);
                                }
                                class_attrs.splice(
                                    0..0,
                                    classes
                                        .into_iter()
                                        .map(|ident| (name_location.clone(), ident, None)),
                                );
                            }
                            Value::Dynamic { expression, .. } => {
                                ps.add_warning(
                                    ParseErrorKind::IncompatibleWithClassColonAttributes,
                                    expression.location(),
                                );
                            }
                        },
                        ClassAttribute::Multiple(..) => unreachable!(),
                    }
                    *class = ClassAttribute::Multiple(class_attrs);
                }
                ElementKind::Slot { .. }
                | ElementKind::Pure { .. }
                | ElementKind::For { .. }
                | ElementKind::If { .. }
                | ElementKind::TemplateRef { .. }
                | ElementKind::Include { .. } => {
                    unreachable!()
                }
            }
        }

        // validate style attributes
        if !style_attrs.is_empty() {
            match &mut element {
                ElementKind::Normal { style, .. } => {
                    match style {
                        StyleAttribute::None => {}
                        StyleAttribute::String(name_location, value) => match value {
                            Value::Static { value, location } => {
                                let mut styles: Vec<(Ident, CompactString)> = vec![];
                                let res = split_inline_style_str(&value, |name, value| {
                                    let str_name = StrName {
                                        name: name.into(),
                                        location: location.clone(),
                                    };
                                    let Some(ident) = str_name.to_css_compatible_ident() else {
                                        styles.clear();
                                        ps.add_warning(
                                            ParseErrorKind::InvalidInlineStyleString,
                                            str_name.location,
                                        );
                                        return false;
                                    };
                                    if style_attrs.iter().find(|x| x.1.name_eq(&ident)).is_some()
                                        || styles.iter().find(|x| x.0.name_eq(&ident)).is_some()
                                    {
                                        styles.clear();
                                        ps.add_warning(
                                            ParseErrorKind::DuplicatedStylePropertyNames,
                                            str_name.location,
                                        );
                                        return false;
                                    }
                                    styles.push((ident, CompactString::new(value)));
                                    true
                                });
                                if let Err(pos) = res {
                                    let pos = location.start.add_offset(pos);
                                    ps.add_warning(
                                        ParseErrorKind::InvalidInlineStyleString,
                                        pos..pos,
                                    );
                                } else {
                                    style_attrs.splice(
                                        0..0,
                                        styles.into_iter().map(|(ident, value)| {
                                            (
                                                name_location.clone(),
                                                ident,
                                                Value::Static {
                                                    value,
                                                    location: location.clone(),
                                                },
                                            )
                                        }),
                                    );
                                }
                            }
                            Value::Dynamic { expression, .. } => {
                                ps.add_warning(
                                    ParseErrorKind::IncompatibleWithStyleColonAttributes,
                                    expression.location(),
                                );
                            }
                        },
                        StyleAttribute::Multiple(..) => unreachable!(),
                    }
                    *style = StyleAttribute::Multiple(style_attrs);
                }
                ElementKind::Slot { .. }
                | ElementKind::Pure { .. }
                | ElementKind::For { .. }
                | ElementKind::If { .. }
                | ElementKind::TemplateRef { .. }
                | ElementKind::Include { .. } => {
                    unreachable!()
                }
            }
        }

        // check `<template name>` and validate `<template is data>`
        if let ElementKind::TemplateRef { target, data } = &element {
            if template_name.is_some() {
                if target.1.location().end != default_attr_position {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, target.0.clone());
                }
                if data.1.location().end != default_attr_position {
                    ps.add_warning(ParseErrorKind::InvalidAttribute, data.0.clone());
                }
            } else {
                if target.1.location().end == default_attr_position {
                    ps.add_warning(ParseErrorKind::MissingModuleName, target.0.clone());
                }
            }
        };
        let allow_for_if = template_name.is_none() && external_tag_type == ExternalTagKind::Include;

        // check script/import tag
        if external_tag_type != ExternalTagKind::Include {
            let ElementKind::Include { path: _ } = &element else {
                unreachable!();
            };
        }

        // collect include and import sources
        if external_tag_type != ExternalTagKind::Script {
            let invalid = match &element {
                ElementKind::Include { path, .. } => {
                    if path.1.name.is_empty() {
                        ps.add_warning(ParseErrorKind::MissingSourcePath, tag_name.location());
                        true
                    } else {
                        false
                    }
                }
                _ => false,
            };
            if invalid {
                element = ElementKind::Pure {
                    children: vec![],
                    let_vars: vec![],
                    slot: None,
                    slot_value_refs: vec![],
                };
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
            let item_name = wx_for_item.unwrap_or_else(|| {
                let name = StrName {
                    name: CompactString::new_inline(DEFAULT_FOR_ITEM_SCOPE_NAME),
                    location: for_location.clone(),
                };
                (for_location.clone(), name)
            });
            let index_name = wx_for_index.unwrap_or_else(|| {
                let name = StrName {
                    name: CompactString::new_inline(DEFAULT_FOR_INDEX_SCOPE_NAME),
                    location: for_location.clone(),
                };
                (for_location.clone(), name)
            });
            let key = wx_key.unwrap_or_else(|| {
                (
                    for_location.clone(),
                    StrName::new_empty(for_location.end.clone()),
                )
            });
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

        // check imcompatibility with wx:* attributes
        let has_wx_attributes = match (&if_condition, &for_list) {
            (IfCondition::None, ForList::None) => false,
            _ => true,
        };
        if has_wx_attributes {
            let slot_value_refs = match &mut element {
                ElementKind::Normal {
                    common:
                        CommonElementAttributes {
                            slot_value_refs, ..
                        },
                    ..
                }
                | ElementKind::Pure {
                    slot_value_refs, ..
                }
                | ElementKind::Slot {
                    common:
                        CommonElementAttributes {
                            slot_value_refs, ..
                        },
                    ..
                } => Some(slot_value_refs),
                ElementKind::For { .. }
                | ElementKind::If { .. }
                | ElementKind::TemplateRef { .. }
                | ElementKind::Include { .. } => None,
            };
            if let Some(slot_value_refs) = slot_value_refs {
                for attr in slot_value_refs.drain(..) {
                    ps.add_warning(
                        ParseErrorKind::IncompatibleWithWxAttribute,
                        attr.prefix_location.unwrap(),
                    );
                }
            }
            let let_vars = match &mut element {
                ElementKind::Normal { let_vars, .. } | ElementKind::Pure { let_vars, .. } => {
                    Some(let_vars)
                }
                ElementKind::Slot { .. }
                | ElementKind::For { .. }
                | ElementKind::If { .. }
                | ElementKind::TemplateRef { .. }
                | ElementKind::Include { .. } => None,
            };
            if let Some(let_vars) = let_vars {
                for attr in let_vars.drain(..) {
                    ps.add_warning(
                        ParseErrorKind::IncompatibleWithWxAttribute,
                        attr.prefix_location.unwrap(),
                    );
                }
            }
        }

        let mut script_module_content = None;
        let new_children = if external_tag_type == ExternalTagKind::Script {
            // parse script tag content
            let ElementKind::Include { path, .. } = &element else {
                unreachable!();
            };
            let (content, content_location) = if self_close_location.is_none() {
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
                (content, content_location)
            } else {
                let pos = ps.position();
                (String::new(), pos..pos)
            };
            if let Some((module_location, module_name)) = script_module {
                if globals
                    .scripts
                    .iter()
                    .find(|x| x.module_name().name_eq(&module_name))
                    .is_some()
                {
                    ps.add_warning(ParseErrorKind::DuplicatedName, module_name.location());
                } else {
                    script_module_content = Some((
                        module_location,
                        module_name,
                        path,
                        content,
                        content_location,
                    ));
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
                } else if let Some(mut x) = tag_name_slices.pop() {
                    if x.has_uppercase() {
                        ps.add_warning(ParseErrorKind::AvoidUppercaseLetters, x.location());
                        x.name = x.name.to_ascii_lowercase().into();
                    }
                    x
                } else {
                    let location = end_tag_start_location.start..close_location.end;
                    ps.add_warning(ParseErrorKind::InvalidEndTag, location.clone());
                    Ident {
                        name: CompactString::new(""),
                        location,
                    }
                };
                if end_tag_name.name.len() > 0
                    && end_tag_name.name != tag_name.name.to_ascii_lowercase()
                {
                    return None;
                }
                ps.skip_whitespace();
                let end_tag_end_pos = ps.position();
                if let Some(x) = ps.skip_until_before(">") {
                    if x.len() > 0 {
                        ps.add_warning(
                            ParseErrorKind::UnexpectedCharacter,
                            end_tag_end_pos..ps.position(),
                        );
                    }
                }
                ps.next(); // '>'
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

        // construct tag location
        let tag_location = TagLocation {
            start: (
                start_tag_start_location.clone(),
                start_tag_end_location.clone(),
            ),
            close: close_location.clone(),
            end: end_tag_location.clone(),
        };

        // write resources list
        match &element {
            ElementKind::Include { path, .. } => match external_tag_type {
                ExternalTagKind::Include => {
                    globals.includes.push(IncludeElement {
                        tag_location: tag_location.clone(),
                        src_location: path.0.clone(),
                        src: path.1.clone(),
                    });
                }
                ExternalTagKind::Import => {
                    globals.imports.push(ImportElement {
                        tag_location: tag_location.clone(),
                        src_location: path.0.clone(),
                        src: path.1.clone(),
                    });
                }
                ExternalTagKind::Script => {}
            },
            _ => {}
        }

        // write script module
        if let Some((module_location, module_name, path, content, content_location)) =
            script_module_content
        {
            if path.1.name.is_empty() {
                globals.scripts.push(Script::Inline {
                    tag_location: tag_location.clone(),
                    module_location,
                    module_name,
                    content,
                    content_location,
                })
            } else {
                if content.trim_matches(super::is_template_whitespace).len() > 0 {
                    ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, content_location);
                }
                globals.scripts.push(Script::GlobalRef {
                    tag_location: tag_location.clone(),
                    module_location,
                    module_name,
                    src_location: path.0.clone(),
                    src: path.1.clone(),
                })
            }
        }

        // write the parsed element
        if external_tag_type == ExternalTagKind::Script {
            // empty
        } else if external_tag_type == ExternalTagKind::Import {
            if let Some(child) = new_children.first() {
                ps.add_warning(ParseErrorKind::ChildNodesNotAllowed, child.location());
            }
        } else if let Some((loc, name)) = template_name {
            if globals
                .sub_templates
                .iter()
                .find(|x| x.name.name_eq(&name))
                .is_some()
            {
                ps.add_warning(ParseErrorKind::DuplicatedName, name.location());
            } else {
                globals.sub_templates.push(TemplateDefinition {
                    tag_location: tag_location.clone(),
                    name_location: loc,
                    name: name.clone(),
                    content: new_children,
                });
            }
        } else {
            let wrap_children = |mut element: Element| -> Vec<Node> {
                match &mut element.kind {
                    ElementKind::Pure {
                        children,
                        let_vars,
                        slot,
                        slot_value_refs,
                    } => {
                        if slot.is_some() || slot_value_refs.len() > 0 || let_vars.len() > 0 {
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
                    tag_location: tag_location.clone(),
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
            let find_if_element_index = |ret: &Vec<Node>| {
                let mut if_index = None;
                for (i, elem) in ret.iter().enumerate().rev() {
                    match elem {
                        Node::Element(Element {
                            kind: ElementKind::If { .. },
                            ..
                        }) => {
                            if_index = Some(i);
                            break;
                        }
                        Node::Comment(..) => {}
                        _ => break,
                    }
                }
                if_index
            };
            let wrap_if_children =
                |ret: &mut Vec<Node>, if_index: usize, wrapped_element: Element| {
                    let mut children = wrap_children(wrapped_element);
                    {
                        let comments = ret.drain((if_index + 1)..);
                        children.splice(0..0, comments);
                    }
                    children
                };
            let wrapped_element = match if_condition {
                IfCondition::None => Some(wrapped_element),
                IfCondition::If(location, value) => {
                    let branch = (location, value, wrap_children(wrapped_element));
                    let elem = Element {
                        kind: ElementKind::If {
                            branches: vec![branch],
                            else_branch: None,
                        },
                        tag_location: tag_location.clone(),
                    };
                    Some(elem)
                }
                IfCondition::Elif(location, value) => {
                    if let Some(if_index) = find_if_element_index(ret) {
                        let branch = (
                            location,
                            value,
                            wrap_if_children(ret, if_index, wrapped_element),
                        );
                        let Node::Element(Element {
                            kind: ElementKind::If { branches, .. },
                            tag_location: if_tag_location,
                        }) = &mut ret[if_index]
                        else {
                            unreachable!();
                        };
                        branches.push(branch);
                        if_tag_location.end = Some(
                            tag_location
                                .end
                                .clone()
                                .unwrap_or(tag_location.start.clone()),
                        );
                        None
                    } else {
                        ps.add_warning(ParseErrorKind::InvalidAttribute, location);
                        Some(wrapped_element)
                    }
                }
                IfCondition::Else(location) => {
                    if let Some(if_index) = find_if_element_index(ret) {
                        let branch = (location, wrap_if_children(ret, if_index, wrapped_element));
                        let Node::Element(Element {
                            kind: ElementKind::If { else_branch, .. },
                            tag_location: if_tag_location,
                        }) = &mut ret[if_index]
                        else {
                            unreachable!();
                        };
                        *else_branch = Some(branch);
                        if_tag_location.end = Some(
                            tag_location
                                .end
                                .clone()
                                .unwrap_or(tag_location.start.clone()),
                        );
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
                ForList::For {
                    list,
                    item_name,
                    index_name,
                    key,
                } => {
                    let children = wrap_children(wrapped_element.unwrap());
                    let elem = Element {
                        kind: ElementKind::For {
                            list,
                            item_name,
                            index_name,
                            key,
                            children,
                        },
                        tag_location: tag_location.clone(),
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

    fn init_scopes_and_binding_map_keys(
        &mut self,
        ps: &mut ParseState,
        sas: &mut ScopeAnalyzeState,
    ) {
        // disable binding-map globally if there is an `include` tag
        let should_globally_disabled = match &self.kind {
            ElementKind::Include { .. } => true,
            ElementKind::Normal { .. }
            | ElementKind::Pure { .. }
            | ElementKind::For { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Slot { .. } => false,
        };
        if should_globally_disabled {
            sas.binding_map_collector.disable_all();
        }

        // update dynamic tree state
        let self_dynamic_tree = match &self.kind {
            ElementKind::Normal { let_vars, .. } | ElementKind::Pure { let_vars, .. } => {
                !let_vars.is_empty()
            }
            ElementKind::For { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => true,
        };
        if self_dynamic_tree {
            sas.inside_dynamic_tree += 1;
        }
        let prev_count = sas.scopes.len();

        // scopes introduced by slot value
        if let Some(slot_value_refs) = self.slot_value_refs() {
            for attr in slot_value_refs {
                sas.scopes
                    .push((attr.value.name.clone(), attr.value.location.clone()));
            }
        }

        // scopes introduced by `let:`
        let original_scope_len = sas.scopes.len();
        if let Some(let_var_refs) = self.let_var_refs() {
            for attr in let_var_refs {
                sas.scopes
                    .push((attr.name.name.clone(), attr.name.location.clone()));
            }
        }
        if let Some(let_var_refs_mut) = self.let_var_refs_mut() {
            for (i, attr) in let_var_refs_mut.enumerate() {
                if let Some(value) = attr.value.as_ref() {
                    if !value.validate_scopes(ps, sas, original_scope_len + i) {
                        attr.value = None;
                    }
                }
            }
        }

        // handling self node values
        self.for_each_value_mut(|x, disable_binding_map| {
            x.init_scopes_and_binding_map_keys(sas, disable_binding_map);
        });

        // scopes introduced by for loop
        match &self.kind {
            ElementKind::For {
                item_name,
                index_name,
                ..
            } => {
                sas.scopes
                    .push((item_name.1.name.clone(), item_name.1.location.clone()));
                sas.scopes
                    .push((index_name.1.name.clone(), index_name.1.location.clone()));
            }
            ElementKind::Normal { .. }
            | ElementKind::Pure { .. }
            | ElementKind::If { .. }
            | ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => {}
        }

        // recurse into children
        match &mut self.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => {
                for child in children {
                    child.init_scopes_and_binding_map_keys(ps, sas);
                }
            }
            ElementKind::If {
                branches,
                else_branch,
            } => {
                for (_, _, children) in branches {
                    for child in children {
                        child.init_scopes_and_binding_map_keys(ps, sas);
                    }
                }
                if let Some((_, children)) = else_branch {
                    for child in children {
                        child.init_scopes_and_binding_map_keys(ps, sas);
                    }
                }
            }
            ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => {}
        }

        // reset scope states
        sas.scopes.truncate(prev_count);
        if self_dynamic_tree {
            sas.inside_dynamic_tree -= 1;
        }
    }
}

#[derive(Debug, Clone, Default)]
#[non_exhaustive]
pub struct CommonElementAttributes {
    pub id: Option<(Range<Position>, Value)>,
    pub slot: Option<(Range<Position>, Value)>,
    pub slot_value_refs: Vec<StaticAttribute>,
    pub event_bindings: Vec<EventBinding>,
    pub data: Vec<Attribute>,
    pub marks: Vec<Attribute>,
}

impl CommonElementAttributes {
    pub(crate) fn is_empty(&self) -> bool {
        if self.id.is_some() {
            return false;
        }
        if self.slot.is_some() {
            return false;
        }
        if self.slot_value_refs.len() > 0 {
            return false;
        }
        if self.event_bindings.len() > 0 {
            return false;
        }
        if self.marks.len() > 0 {
            return false;
        }
        true
    }

    fn for_each_value_mut(&mut self, mut f: impl FnMut(&mut Value, bool)) {
        let CommonElementAttributes {
            id,
            slot,
            slot_value_refs: _,
            event_bindings,
            data,
            marks,
        } = self;
        if let Some(id) = id {
            f(&mut id.1, false);
        }
        if let Some(slot) = slot {
            f(&mut slot.1, false);
        }
        for ev in event_bindings {
            if let Some(value) = ev.value.as_mut() {
                f(value, false);
            }
        }
        for attr in data {
            if let Some(value) = attr.value.as_mut() {
                f(value, false);
            }
        }
        for attr in marks {
            if let Some(value) = attr.value.as_mut() {
                f(value, false);
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct CustomAttribute {
    pub colon_separated_name: Vec<Ident>,
    pub value: Option<Value>,
}

impl CustomAttribute {
    fn parse_next(ps: &mut ParseState) -> Option<Self> {
        let colon_separated_name = Ident::parse_colon_separated(ps);
        let last = colon_separated_name.last()?;
        let value = Attribute::parse_optional_value(ps, last.to_owned())?.value;
        let ret = CustomAttribute {
            colon_separated_name,
            value,
        };
        Some(ret)
    }

    fn parse_until_tag_end(ps: &mut ParseState) -> Vec<Self> {
        let mut ret = vec![];
        loop {
            ps.skip_whitespace();
            let Some(peek) = ps.peek::<0>() else { break };
            if peek == '>' {
                break;
            }
            if Ident::is_start_char(peek) {
                if let Some(attr) = Self::parse_next(ps) {
                    ret.push(attr);
                }
            } else {
                let pos = ps.position();
                loop {
                    let Some(peek) = ps.peek::<0>() else { break };
                    if peek == '>' || Ident::is_start_char(peek) || char::is_whitespace(peek) {
                        break;
                    }
                    ps.next();
                }
                ps.add_warning(ParseErrorKind::InvalidAttributeName, pos..ps.position());
            }
        }
        ret
    }
}

#[derive(Debug, Clone)]
pub struct NormalAttribute {
    pub name: Ident,
    pub value: Option<Value>,
    pub prefix: NormalAttributePrefix,
}

#[derive(Debug, Clone)]
pub enum NormalAttributePrefix {
    None,
    Model(Range<Position>),
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct Attribute {
    pub name: Ident,
    pub value: Option<Value>,
    pub prefix_location: Option<Range<Position>>,
}

impl Attribute {
    #[inline(always)]
    fn parse_optional_value_part<R>(
        ps: &mut ParseState,
        quoted_parser: impl FnOnce(&mut ParseState, char) -> R,
        expression_parser: impl FnOnce(&mut ParseState) -> Option<R>,
        str_name: impl FnOnce(StrName) -> R,
        default: impl FnOnce() -> R,
    ) -> Option<R> {
        let ws_before_eq = ps.skip_whitespace();
        let ret = if let Some(eq_range) = ps.consume_str("=") {
            if let Some(range) = ws_before_eq {
                ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
            }
            let ws_after_eq = ps.skip_whitespace();
            let attr_value = match ps.peek::<0>() {
                Some(ch) if ch == '"' || ch == '\'' => {
                    // parse as `"..."`
                    if let Some(range) = ws_after_eq {
                        ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                    }
                    ps.next(); // ch
                    let value = quoted_parser(ps, ch);
                    ps.next(); // ch
                    value
                }
                Some('{') if ps.peek_str("{{") => {
                    // parse `{{...}}`
                    if let Some(range) = ws_after_eq {
                        ps.add_warning(ParseErrorKind::UnexpectedWhitespace, range);
                    }
                    expression_parser(ps)?
                }
                Some(ch) if ws_after_eq.is_none() && Ident::is_following_char(ch) => {
                    let v = StrName::parse_until_before(ps, |ps| match ps.peek::<0>() {
                        None => true,
                        Some(ch) => !Ident::is_following_char(ch),
                    });
                    ps.add_warning(ParseErrorKind::ShouldQuoted, v.location());
                    str_name(v)
                }
                _ => {
                    ps.add_warning(ParseErrorKind::MissingAttributeValue, eq_range);
                    default()
                }
            };
            ps.skip_whitespace();
            attr_value
        } else {
            default()
        };
        Some(ret)
    }

    /// Parse the value part of the attribute, including the leading `=` .
    pub fn parse_optional_value(ps: &mut ParseState, name: Ident) -> Option<Self> {
        let mut is_value_unspecified = false;
        let value = Attribute::parse_optional_value_part(
            ps,
            |ps, ch| {
                Value::parse_until_before(ps, |ps: &mut ParseState| ps.peek::<0>() == Some(ch))
            },
            |ps| Value::parse_data_binding(ps, false),
            |v| Value::Static {
                value: v.name,
                location: v.location,
            },
            || {
                is_value_unspecified = true;
                Value::new_empty(name.location.end)
            },
        );
        value.map(|value| Self {
            name,
            value: (!is_value_unspecified).then_some(value),
            prefix_location: None,
        })
    }

    /// Parse the (object) value part of the attribute, including the leading `=` .
    ///
    /// Unlike `parse_optional_value` ,
    /// this function expect the value to be an object value binding.
    /// It is useful when compiling the `data` field in `<template />` .
    ///
    pub fn parse_optional_value_as_object(ps: &mut ParseState, name: Ident) -> Option<Self> {
        let mut is_value_unspecified = false;
        let value = Attribute::parse_optional_value_part(
            ps,
            |ps, ch| {
                let v = ps.try_parse(|ps| {
                    let v = Value::parse_data_binding(ps, true)?;
                    match ps.peek::<0>() {
                        Some(x) => (x == ch).then_some(v),
                        None => Some(v),
                    }
                });
                if let Some(v) = v {
                    v
                } else {
                    let value = Value::parse_until_before(ps, |ps: &mut ParseState| {
                        ps.peek::<0>() == Some(ch)
                    });
                    ps.add_warning(ParseErrorKind::InvalidAttributeValue, value.location());
                    Value::new_empty(value.location().start)
                }
            },
            |ps| Value::parse_data_binding(ps, true),
            |v| Value::Static {
                value: v.name,
                location: v.location,
            },
            || {
                is_value_unspecified = true;
                Value::new_empty(name.location.end)
            },
        );
        value.map(|value| Self {
            name,
            value: (!is_value_unspecified).then_some(value),
            prefix_location: None,
        })
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct StaticAttribute {
    pub name: Ident,
    pub value: StrName,
    pub prefix_location: Option<Range<Position>>,
}

impl StaticAttribute {
    /// Parse the value part of the attribute, including the leading `=` .
    pub fn parse_optional_value(ps: &mut ParseState, name: Ident) -> Option<Self> {
        let value = Attribute::parse_optional_value_part(
            ps,
            |ps, ch| {
                StrName::parse_until_before(ps, |ps: &mut ParseState| ps.peek::<0>() == Some(ch))
            },
            |ps| {
                let value = Value::parse_data_binding(ps, false)?;
                ps.add_warning(ParseErrorKind::DataBindingNotAllowed, value.location());
                None
            },
            |v| v,
            || StrName::new_empty(name.location.end),
        );
        value.map(|value| Self {
            name,
            value,
            prefix_location: None,
        })
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum ClassAttribute {
    None,
    String(Range<Position>, Value),
    Multiple(Vec<(Range<Position>, Ident, Option<Value>)>),
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum StyleAttribute {
    None,
    String(Range<Position>, Value),
    Multiple(Vec<(Range<Position>, Ident, Value)>),
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub struct EventBinding {
    pub name: Ident,
    pub value: Option<Value>,
    pub is_catch: bool,
    pub is_mut: bool,
    pub is_capture: bool,
    pub prefix_location: Range<Position>,
}

/// An identifier.
///
/// It can be used as tag name and attribute name.
/// Unlike JavaScript identifier, it can contain `-` .
///
#[derive(Debug, Clone)]
#[non_exhaustive]
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
        ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ch == '_'
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

    fn is_css_start_char(ch: char) -> bool {
        ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ch == '_' || ch == '-'
    }

    fn is_css_following_char(ch: char) -> bool {
        Self::is_css_start_char(ch) || ('0'..='9').contains(&ch)
    }

    fn has_uppercase(&self) -> bool {
        for c in self.name.chars() {
            if c.is_uppercase() {
                return true;
            }
        }
        false
    }

    fn name_eq(&self, other: &Self) -> bool {
        self.name == other.name
    }

    /// Check if a `str` is a valid identifier.
    pub fn is_valid(s: &str) -> bool {
        let mut chars = s.chars();
        let Some(first) = chars.next() else {
            return false;
        };
        if !Self::is_start_char(first) {
            return false;
        }
        for ch in chars {
            if !Self::is_following_char(ch) {
                return false;
            }
        }
        true
    }

    /// Parse colon-seperated identifiers.
    ///
    /// For example, `wx:for-item` will be parsed as two identifiers `wx` and `for-item` .
    pub fn parse_colon_separated(ps: &mut ParseState) -> Vec<Self> {
        let Some(peek) = ps.peek::<0>() else {
            return vec![];
        };
        if !Self::is_start_char(peek) {
            return vec![];
        }

        // parse segments
        let mut ret = Vec::with_capacity(2);
        let pos = ps.position();
        let mut cur_name = Self {
            name: CompactString::new_inline(""),
            location: pos..pos,
        };
        loop {
            match ps.next().unwrap() {
                ':' => {
                    let pos = ps.position();
                    let prev = std::mem::replace(
                        &mut cur_name,
                        Self {
                            name: CompactString::new_inline(""),
                            location: pos..pos,
                        },
                    );
                    ret.push(prev);
                }
                ch => {
                    cur_name.name.push(ch);
                    cur_name.location.end = ps.position();
                }
            }
            let Some(peek) = ps.peek::<0>() else { break };
            if peek != ':' && !Self::is_following_char(peek) {
                break;
            };
        }
        ret.push(cur_name);

        ret
    }
}

/// A static string with location information.
#[derive(Debug, Clone)]
#[non_exhaustive]
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
    pub fn to_ident(&self) -> Option<Ident> {
        let mut chars = self.name.chars();
        if !Ident::is_start_char(chars.next()?) {
            return None;
        }
        for ch in chars {
            if !Ident::is_following_char(ch) {
                return None;
            }
        }
        Some(Ident {
            name: self.name.clone(),
            location: self.location(),
        })
    }

    pub fn to_css_compatible_ident(&self) -> Option<Ident> {
        let mut chars = self.name.chars();
        if !Ident::is_css_start_char(chars.next()?) {
            return None;
        }
        for ch in chars {
            if !Ident::is_css_following_char(ch) {
                return None;
            }
        }
        Some(Ident {
            name: self.name.clone(),
            location: self.location(),
        })
    }

    pub fn is(&self, s: impl AsRef<str>) -> bool {
        self.name == s.as_ref()
    }

    pub fn name_eq(&self, other: &Self) -> bool {
        self.name == other.name
    }

    pub fn new_empty(pos: Position) -> Self {
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
                                ps.add_warning(
                                    ParseErrorKind::IllegalEntity,
                                    start_pos..ps.position(),
                                );
                                return None;
                            };
                            match next {
                                ';' => break,
                                '0'..='9' | 'a'..='f' | 'A'..='F' => {}
                                _ => {
                                    ps.add_warning(
                                        ParseErrorKind::IllegalEntity,
                                        start_pos..ps.position(),
                                    );
                                    return None;
                                }
                            }
                        }
                    } else if ('0'..='9').contains(&next) {
                        // parse `&#...;`
                        loop {
                            let Some(next) = ps.next() else {
                                ps.add_warning(
                                    ParseErrorKind::IllegalEntity,
                                    start_pos..ps.position(),
                                );
                                return None;
                            };
                            match next {
                                ';' => break,
                                '0'..='9' => {}
                                _ => {
                                    ps.add_warning(
                                        ParseErrorKind::IllegalEntity,
                                        start_pos..ps.position(),
                                    );
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

    /// Parse until the `until` returns `true` .
    ///
    /// HTML Entities will be parsed.
    ///
    pub fn parse_until_before(
        ps: &mut ParseState,
        until: impl Fn(&mut ParseState) -> bool,
    ) -> Self {
        let mut name = CompactString::new_inline("");
        let start_pos = ps.position();
        loop {
            if ps.ended() || until(ps) {
                break;
            }
            name.push_str(&StrName::parse_next_entity(ps));
        }
        Self {
            name,
            location: start_pos..ps.position(),
        }
    }

    /// Check whether the name is a valid JavaScript identifier.
    pub fn is_valid_js_identifier(&self) -> bool {
        let mut chars = self.name.chars();
        let first = chars.next();
        match first {
            None => false,
            Some(ch) if !Ident::is_js_start_char(ch) => false,
            Some(_) => chars.find(|ch| !Ident::is_js_following_char(*ch)).is_none(),
        }
    }

    /// Check whether the name is a valid class name.
    pub fn is_valid_class_name(&self) -> bool {
        let mut chars = self.name.chars();
        let first = chars.next();
        match first {
            None => false,
            Some(ch) if !Ident::is_css_start_char(ch) => false,
            Some(_) => chars
                .find(|ch| !Ident::is_css_following_char(*ch))
                .is_none(),
        }
    }
}

/// A static string or an expression.
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Value {
    #[non_exhaustive]
    Static {
        value: CompactString,
        location: Range<Position>,
    },
    #[non_exhaustive]
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
            Self::Dynamic {
                expression: _,
                double_brace_location,
                binding_map_keys: _,
            } => double_brace_location.0.start..double_brace_location.1.end,
        }
    }
}

impl Value {
    pub fn new_empty(pos: Position) -> Self {
        Self::Static {
            value: CompactString::new_inline(""),
            location: pos..pos,
        }
    }

    pub fn is_empty(&self) -> bool {
        if let Self::Static { value, .. } = self {
            value.is_empty()
        } else {
            false
        }
    }

    pub fn new_expression(
        expression: Box<Expression>,
        double_brace_location: (Range<Position>, Range<Position>),
    ) -> Self {
        Self::Dynamic {
            expression,
            double_brace_location,
            binding_map_keys: None,
        }
    }

    fn parse_data_binding(ps: &mut ParseState, is_template_data: bool) -> Option<Self> {
        let Some(double_brace_left) = ps.consume_str("{{") else {
            return None;
        };
        if let Some(range) = ps.try_parse(|ps| {
            ps.skip_whitespace_with_js_comments();
            ps.consume_str("}}")
        }) {
            ps.add_warning(ParseErrorKind::EmptyExpression, range.start..range.start);
            return Some(Self::Static {
                value: CompactString::new_inline(""),
                location: double_brace_left.start..range.end,
            });
        }
        let Some(expression) = Expression::parse_expression_or_object_inner(ps, is_template_data)
        else {
            if ps.skip_until_after("}}").is_none() {
                ps.add_warning(
                    ParseErrorKind::MissingExpressionEnd,
                    double_brace_left.clone(),
                );
            }
            return Some(Self::Static {
                value: CompactString::new_inline(""),
                location: double_brace_left.start..ps.position(),
            });
        };
        ps.skip_whitespace();
        let end_pos = ps.position();
        match ps.skip_until_before("}}") {
            None => {
                ps.add_warning(
                    ParseErrorKind::MissingExpressionEnd,
                    double_brace_left.clone(),
                );
                return Some(Self::Static {
                    value: CompactString::new_inline(""),
                    location: double_brace_left.start..ps.position(),
                });
            }
            Some(s) => {
                if s.len() > 0 {
                    ps.add_warning(
                        ParseErrorKind::UnexpectedExpressionCharacter,
                        end_pos..end_pos,
                    );
                    ps.consume_str("}}");
                    return Some(Self::Static {
                        value: CompactString::new_inline(""),
                        location: double_brace_left.start..ps.position(),
                    });
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
        fn wrap_to_string(expr: Box<Expression>, location: Range<Position>) -> Box<Expression> {
            Box::new(Expression::ToStringWithoutUndefined {
                value: expr,
                location,
            })
        }
        let mut has_wrap_to_string = false;
        loop {
            if until(ps) || ps.ended() {
                break;
            };
            let start_pos = ps.position();

            // try parse `{{ ... }}`
            if ps.peek_str("{{") {
                match ps.try_parse(|ps| Self::parse_data_binding(ps, false)) {
                    Some(Value::Dynamic {
                        expression,
                        double_brace_location,
                        binding_map_keys: _,
                    }) => {
                        let expression = match ret {
                            Self::Static { value, location } => {
                                if value.is_empty() {
                                    expression
                                } else {
                                    let left = Box::new(Expression::LitStr { value, location });
                                    let right =
                                        wrap_to_string(expression, double_brace_location.1.clone());
                                    has_wrap_to_string = true;
                                    Box::new(Expression::Plus {
                                        left,
                                        right,
                                        location: double_brace_location.0.clone(),
                                    })
                                }
                            }
                            Self::Dynamic {
                                expression: left,
                                double_brace_location: left_double_brace_location,
                                binding_map_keys: _,
                            } => {
                                let left = if has_wrap_to_string {
                                    left
                                } else {
                                    wrap_to_string(left, left_double_brace_location.1.clone())
                                };
                                let right =
                                    wrap_to_string(expression, double_brace_location.1.clone());
                                has_wrap_to_string = true;
                                Box::new(Expression::Plus {
                                    left,
                                    right,
                                    location: double_brace_location.0.clone(),
                                })
                            }
                        };
                        ret = Self::Dynamic {
                            expression,
                            double_brace_location,
                            binding_map_keys: None,
                        };
                        continue;
                    }
                    Some(Value::Static { .. }) => {
                        continue;
                    }
                    None => {}
                }
            }

            // convert `Self` format if needed
            ret = if let Self::Dynamic {
                expression,
                double_brace_location,
                binding_map_keys,
            } = ret
            {
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
                    let left = if has_wrap_to_string {
                        expression
                    } else {
                        wrap_to_string(expression, double_brace_location.1.clone())
                    };
                    let right = Box::new(Expression::LitStr {
                        value: CompactString::new_inline(""),
                        location: start_pos..start_pos,
                    });
                    has_wrap_to_string = true;
                    let expression = Box::new(Expression::Plus {
                        left,
                        right,
                        location: double_brace_location.0.clone(),
                    });
                    Self::Dynamic {
                        expression,
                        double_brace_location,
                        binding_map_keys,
                    }
                } else {
                    Self::Dynamic {
                        expression,
                        double_brace_location,
                        binding_map_keys,
                    }
                }
            } else {
                ret
            };
            let (ret_value, ret_location, ret_location2) = match &mut ret {
                Self::Static { value, location } => (value, location, None),
                Self::Dynamic {
                    expression,
                    double_brace_location,
                    ..
                } => {
                    if let Expression::Plus { right, .. } = &mut **expression {
                        if let Expression::LitStr { value, location } = &mut **right {
                            (value, location, Some(&mut double_brace_location.1))
                        } else {
                            unreachable!()
                        }
                    } else {
                        unreachable!()
                    }
                }
            };

            // parse next char
            loop {
                ret_value.push_str(&StrName::parse_next_entity(ps));
                if until(ps) || ps.ended() || ps.peek_str("{{") {
                    break;
                };
            }
            ret_location.end = ps.position();
            if let Some(x) = ret_location2 {
                x.end = ret_location.end.clone();
            }
        }
        ret
    }

    fn validate_scopes(&self, ps: &mut ParseState, sas: &ScopeAnalyzeState, limit: usize) -> bool {
        match self {
            Self::Static { .. } => true,
            Self::Dynamic { expression, .. } => expression.validate_scopes(ps, &sas.scopes, limit),
        }
    }

    fn init_scopes_and_binding_map_keys(
        &mut self,
        sas: &mut ScopeAnalyzeState,
        disable_binding_map: bool,
    ) {
        match self {
            Self::Static { .. } => {}
            Self::Dynamic {
                expression,
                binding_map_keys,
                ..
            } => {
                expression.convert_scopes(&sas.scopes);
                if sas.inside_dynamic_tree > 0 || disable_binding_map {
                    expression.disable_binding_map_keys(&mut sas.binding_map_collector);
                } else {
                    let mut bmk = BindingMapKeys::new();
                    expression.collect_binding_map_keys(&mut sas.binding_map_collector, &mut bmk);
                    *binding_map_keys = Some(bmk);
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Script {
    #[non_exhaustive]
    Inline {
        tag_location: TagLocation,
        module_location: Range<Position>,
        module_name: StrName,
        content: String,
        content_location: Range<Position>,
    },
    #[non_exhaustive]
    GlobalRef {
        tag_location: TagLocation,
        module_location: Range<Position>,
        module_name: StrName,
        src_location: Range<Position>,
        src: StrName,
    },
}

impl Script {
    pub fn module_name(&self) -> &StrName {
        match self {
            Self::Inline { module_name, .. } | Self::GlobalRef { module_name, .. } => module_name,
        }
    }

    pub fn module_location(&self) -> Range<Position> {
        match self {
            Self::Inline {
                module_location, ..
            }
            | Self::GlobalRef {
                module_location, ..
            } => module_location.clone(),
        }
    }

    pub fn tag_location(&self) -> TagLocation {
        match self {
            Self::Inline { tag_location, .. } | Self::GlobalRef { tag_location, .. } => {
                tag_location.clone()
            }
        }
    }
}

fn split_inline_style_str(
    s: &str,
    mut f: impl FnMut(&str, &str) -> bool,
) -> Result<bool, Position> {
    fn conv_pos(x: cssparser::BasicParseError) -> Position {
        Position {
            line: x.location.line,
            utf16_col: x.location.column - 1,
        }
    }
    let mut input = cssparser::ParserInput::new(s);
    let mut parser = cssparser::Parser::new(&mut input);
    while !parser.is_exhausted() {
        parser.skip_whitespace();
        let name = parser.expect_ident().map_err(conv_pos)?.clone();
        parser.skip_whitespace();
        parser.expect_colon().map_err(conv_pos)?;
        parser.skip_whitespace();
        let value_start = parser.position().byte_index();
        let mut cur = value_start;
        while !parser.is_exhausted() {
            match parser.next().map_err(conv_pos)? {
                cssparser::Token::Semicolon => break,
                _ => {}
            }
            cur = parser.position().byte_index();
        }
        let value = &s[value_start..cur];
        if !f(&name, value) {
            return Ok(false);
        }
    }
    Ok(true)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn meta_tag_parsing() {
        case!("<!META>", "<!META>", ParseErrorKind::UnknownMetaTag, 0..7);
        case!(
            "<!META aA>",
            "<!META aA>",
            ParseErrorKind::UnknownMetaTag,
            0..10
        );
        case!(
            r#"<!META aA="">"#,
            r#"<!META aA="">"#,
            ParseErrorKind::UnknownMetaTag,
            0..13
        );
        case!(
            r#"<!META aA={{ 1 }}>"#,
            r#"<!META aA="{{1}}">"#,
            ParseErrorKind::UnknownMetaTag,
            0..18
        );
        case!(
            r#"<!META aA="a {{ 1 }}">"#,
            r#"<!META aA="a {{1}}">"#,
            ParseErrorKind::UnknownMetaTag,
            0..22
        );
    }

    #[test]
    fn value_parsing() {
        case!("{{}}", r#""#, ParseErrorKind::EmptyExpression, 2..2);
        case!("{{ }}", r#""#, ParseErrorKind::EmptyExpression, 3..3);
        case!("{ {", r#"{ {"#);
        case!("{{ a } }", "", ParseErrorKind::MissingExpressionEnd, 0..2);
        case!(
            "{{ a b }}",
            "",
            ParseErrorKind::UnexpectedExpressionCharacter,
            5..5
        );
        case!(" a\t{{ b }}", " a\t{{b}}");
        case!("{{ b }} a ", r#"{{b}} a "#);
        case!("{{ a }}{{ b }}", r#"{{a}}{{b}}"#);
        case!("{{ 'a' }}", r#"a"#);
        case!("{{propB}}:{{propA}}", r#"{{propB}}:{{propA}}"#);
    }

    #[test]
    fn entities_parsing() {
        case!("&#xG;", r#"&amp;#xG;"#, ParseErrorKind::IllegalEntity, 0..4);
        case!("&#x ", r#"&amp;#x "#, ParseErrorKind::IllegalEntity, 0..4);
        case!("&#x41;", r#"A"#);
        case!("&#A;", r#"&amp;#A;"#, ParseErrorKind::IllegalEntity, 0..3);
        case!("&# ", r#"&amp;# "#, ParseErrorKind::IllegalEntity, 0..3);
        case!("&#97;", r#"a"#);
        case!("&lt", r#"&amp;lt"#);
        case!("&lt ", r#"&amp;lt "#);
        case!("&lt;", r#"&lt;"#);
        case!("&gt;", r#">"#);
        case!("&", r#"&amp;"#);
    }

    #[test]
    fn white_space_parsing() {
        case!("&nbsp;", "\u{A0}");
        case!("<div>&#x85;</div>", "<div>\u{85}</div>");
        case!("<div> &#x2028; </div>", "<div> \u{2028} </div>");
        case!("{{ '\t' }}", r#"{{"\t"}}"#);
    }

    #[test]
    fn tag_structure() {
        case!("<", r#"&lt;"#);
        case!("<-", r#"&lt;-"#);
        case!("<div", r#"<div/>"#, ParseErrorKind::IncompleteTag, 0..1);
        case!("<div ", r#"<div/>"#, ParseErrorKind::IncompleteTag, 0..1);
        case!("<div>", r#"<div/>"#, ParseErrorKind::MissingEndTag, 1..4);
        case!(
            "<div><span></div>",
            r#"<div><span/></div>"#,
            ParseErrorKind::MissingEndTag,
            6..10
        );
        case!(
            "<div><span></span>",
            r#"<div><span/></div>"#,
            ParseErrorKind::MissingEndTag,
            1..4
        );
        case!(
            "<div></span><a href=></a>",
            r#"<div/><a href/>"#,
            ParseErrorKind::MissingEndTag,
            1..4,
            ParseErrorKind::InvalidEndTag,
            5..12,
            ParseErrorKind::MissingAttributeValue,
            19..20
        );
        case!("<div >", r#"<div/>"#, ParseErrorKind::MissingEndTag, 1..4);
        case!(
            "<a:div/>",
            r#"<wx-x/>"#,
            ParseErrorKind::IllegalNamePrefix,
            1..2
        );
        case!(
            "<div/ ></div>",
            r#"<div/>"#,
            ParseErrorKind::UnexpectedCharacter,
            4..5
        );
        case!(
            "<div a:mark:c/>",
            r#"<div/>"#,
            ParseErrorKind::InvalidAttributePrefix,
            5..6
        );
        case!(
            "<div marks:c/>",
            r#"<div/>"#,
            ParseErrorKind::InvalidAttributePrefix,
            5..10
        );
        case!(
            "<div mark:/>",
            r#"<div/>"#,
            ParseErrorKind::InvalidAttributePrefix,
            5..9
        );
        case!(
            "<div a =''/>",
            r#"<div a=""/>"#,
            ParseErrorKind::UnexpectedWhitespace,
            6..7
        );
        case!(
            "<div a= ''/>",
            r#"<div a=""/>"#,
            ParseErrorKind::UnexpectedWhitespace,
            7..8
        );
        case!(
            "<div a= {{b}}/>",
            r#"<div a="{{b}}"/>"#,
            ParseErrorKind::UnexpectedWhitespace,
            7..8
        );
        case!(
            "<div a= b/>",
            r#"<div a b/>"#,
            ParseErrorKind::MissingAttributeValue,
            6..7
        );
        case!(
            "<div a=></div>",
            r#"<div a/>"#,
            ParseErrorKind::MissingAttributeValue,
            6..7
        );
        case!(
            "<div a=/>",
            r#"<div a/>"#,
            ParseErrorKind::MissingAttributeValue,
            6..7
        );
        case!(
            "<div a=",
            r#"<div a/>"#,
            ParseErrorKind::MissingAttributeValue,
            6..7,
            ParseErrorKind::IncompleteTag,
            0..1
        );
        case!(
            "<div #@></div>",
            r#"<div/>"#,
            ParseErrorKind::InvalidAttributeName,
            5..7
        );
        case!(
            "<div a='1' a='2'></div>",
            r#"<div a="1"/>"#,
            ParseErrorKind::DuplicatedAttribute,
            11..12
        );
        case!(
            "<div a a></div>",
            r#"<div a/>"#,
            ParseErrorKind::DuplicatedAttribute,
            7..8
        );
        case!(
            "<div></div  a=''>",
            r#"<div/>"#,
            ParseErrorKind::UnexpectedCharacter,
            12..16
        );
        case!("<div></>", r#"<div/>"#, ParseErrorKind::InvalidEndTag, 5..7);
    }

    #[test]
    fn normal_element() {
        case!(
            "<Div></div>",
            r#"<Div/>"#,
            ParseErrorKind::AvoidUppercaseLetters,
            1..4
        );
        case!(
            "<div></Div>",
            r#"<div/>"#,
            ParseErrorKind::AvoidUppercaseLetters,
            7..10
        );
        case!(
            "<diV></diV>",
            r#"<diV/>"#,
            ParseErrorKind::AvoidUppercaseLetters,
            1..4,
            ParseErrorKind::AvoidUppercaseLetters,
            7..10
        );
        case!("<div a='1'></div>", r#"<div a="1"/>"#);
        case!(
            "<div a=1></div>",
            r#"<div a="1"/>"#,
            ParseErrorKind::ShouldQuoted,
            7..8
        );
        case!("<div class='a b'></div>", r#"<div class="a b"/>"#);
        case!("<div style='a:b'></div>", r#"<div style="a:b"/>"#);
        case!("<div model:a='{{b}}'></div>", r#"<div model:a="{{b}}"/>"#);
        case!("<div model:a=''></div>", r#"<div model:a=""/>"#);
        case!("<div model:a></div>", r#"<div model:a/>"#);
        case!("<div change:a='fn'></div>", r#"<div change:a="fn"/>"#);
        case!(
            "<div change:a></div>",
            r#"<div change:a/>"#,
            ParseErrorKind::MissingAttributeValue,
            12..13
        );
        case!("<div change:a=''></div>", r#"<div change:a/>"#);
        case!("<div worklet:a='fn'></div>", r#"<div worklet:a="fn"/>"#);
        case!("<div worklet:a=''></div>", r#"<div worklet:a/>"#);
        case!(
            "<div worklet:a='{{ a }}'></div>",
            r#"<div worklet:a="{{ a }}"/>"#,
            ParseErrorKind::DataBindingNotAllowed,
            16..23
        );
        case!("<div mark:aB='fn'></div>", r#"<div mark:aB="fn"/>"#);
        case!("<div mark:aB=''></div>", r#"<div mark:aB=""/>"#);
        case!("<div mark:aB></div>", r#"<div mark:aB/>"#);
        case!("<div data:aB='fn'></div>", r#"<div data:aB="fn"/>"#);
        case!("<div data:aB=''></div>", r#"<div data:aB=""/>"#);
        case!("<div data:aB></div>", r#"<div data:aB/>"#);
        case!(
            "<div data-a-bC='fn'></div>",
            r#"<div data-a-bc="fn"/>"#,
            ParseErrorKind::AvoidUppercaseLetters,
            5..14
        );
        case!("<div generic:a='A'></div>", r#"<div generic:a="A"/>"#);
        case!(
            "<div generic:a='{{ A }}'></div>",
            r#"<div generic:a="{{ A }}"/>"#,
            ParseErrorKind::DataBindingNotAllowed,
            16..23
        );
        case!("<div extra-attr:a='A'></div>", r#"<div extra-attr:a="A"/>"#);
        case!(
            "<div extra-attr:a='{{ A }}'></div>",
            r#"<div extra-attr:a="{{ A }}"/>"#,
            ParseErrorKind::DataBindingNotAllowed,
            19..26
        );
        case!("<div slot='a'></div>", r#"<div slot="a"/>"#);
        case!("<div slot:a></div>", r#"<div slot:a/>"#);
        case!("<div slot:a-b></div>", r#"<div slot:aB/>"#);
        case!("<div slot:a='A'></div>", r#"<div slot:a="A"/>"#);
        case!(
            "<div slot:a='A '></div>",
            r#"<div slot:a="A "/>"#,
            ParseErrorKind::InvalidScopeName,
            13..15
        );
        case!(
            "<div let:a-b='{{a}}'>{{ aB }}</div>",
            r#"<div let:aB="{{a}}">{{aB}}</div>"#
        );
        case!(
            "<div let:a></div>",
            r#"<div let:a/>"#,
            ParseErrorKind::MissingAttributeValue,
            9..10
        );
        case!(
            "<div let:a='{{a}}'></div>",
            r#"<div let:a/>"#,
            ParseErrorKind::UninitializedScope,
            14..15
        );
        case!(
            "<div let:a='{{b}}' let:b=''></div>",
            r#"<div let:a let:b/>"#,
            ParseErrorKind::UninitializedScope,
            14..15
        );
    }

    #[test]
    fn class_attrs() {
        case!(
            "<div class:c='{{c}}' class:-b></div>",
            r#"<div class:c="{{c}}" class:-b/>"#
        );
        case!(
            "<div class:c='{{c}}' class='a -b'></div>",
            r#"<div class:a class:-b class:c="{{c}}"/>"#
        );
        case!(
            "<div class='{{b}}' class:c></div>",
            r#"<div class:c/>"#,
            ParseErrorKind::IncompatibleWithClassColonAttributes,
            14..15
        );
        case!(
            "<div class='a {{b}}' class:c></div>",
            r#"<div class:c/>"#,
            ParseErrorKind::IncompatibleWithClassColonAttributes,
            12..19
        );
        case!(
            "<div class='a .b' class:c></div>",
            r#"<div class:c/>"#,
            ParseErrorKind::InvalidClassNames,
            12..16
        );
        case!(
            "<div class='a a' class:c></div>",
            r#"<div class:c/>"#,
            ParseErrorKind::DuplicatedClassNames,
            12..15
        );
        case!(
            "<div class='a b' class:a class:c></div>",
            r#"<div class:a class:c/>"#,
            ParseErrorKind::DuplicatedClassNames,
            12..15
        );
    }

    #[test]
    fn style_attrs() {
        case!(
            "<div style:c='{{c}}' style:-b></div>",
            r#"<div style:c="{{c}}" style:-b/>"#,
            ParseErrorKind::MissingAttributeValue,
            27..29
        );
        case!(
            "<div style:c='{{c}}' style=' a: 1; -b-b: a b '></div>",
            r#"<div style:a="1" style:-b-b="a b" style:c="{{c}}"/>"#
        );
        case!(
            "<div style='{{b}}' style:c='c'></div>",
            r#"<div style:c="c"/>"#,
            ParseErrorKind::IncompatibleWithStyleColonAttributes,
            14..15
        );
        case!(
            "<div style='a {{b}}' style:c='c'></div>",
            r#"<div style:c="c"/>"#,
            ParseErrorKind::IncompatibleWithStyleColonAttributes,
            12..19
        );
        case!(
            "<div style='a: 1; .b' style:c='c'></div>",
            r#"<div style:c="c"/>"#,
            ParseErrorKind::InvalidInlineStyleString,
            18..18
        );
        case!(
            "<div style='a: 1; a: 2;' style:c='c'></div>",
            r#"<div style:c="c"/>"#,
            ParseErrorKind::DuplicatedStylePropertyNames,
            12..23
        );
        case!(
            "<div style='a: 1; b:' style:a='c' style:c='a'></div>",
            r#"<div style:a="c" style:c="a"/>"#,
            ParseErrorKind::DuplicatedStylePropertyNames,
            12..20
        );
    }

    #[test]
    fn event_listener() {
        case!(
            "<slot bind:a='f1' bind:a='f2'></slot>",
            r#"<slot bind:a="f1" bind:a="f2"/>"#
        );
        case!("<slot catch:a='f1'></slot>", r#"<slot catch:a="f1"/>"#);
        case!(
            "<slot mut-bind:a='f1'></slot>",
            r#"<slot mut-bind:a="f1"/>"#
        );
        case!(
            "<slot capture-bind:a='f1'></slot>",
            r#"<slot capture-bind:a="f1"/>"#
        );
        case!(
            "<slot capture-catch:a='f1'></slot>",
            r#"<slot capture-catch:a="f1"/>"#
        );
        case!(
            "<slot capture-mut-bind:a='f1'></slot>",
            r#"<slot capture-mut-bind:a="f1"/>"#
        );
    }

    #[test]
    fn pure_block() {
        case!("<block> abc </block>", "<block> abc </block>");
        case!(
            "<block a=''></block>",
            r#"<block/>"#,
            ParseErrorKind::InvalidAttribute,
            7..8
        );
        case!(
            "<block mark:aB='fn'></block>",
            r#"<block/>"#,
            ParseErrorKind::InvalidAttribute,
            12..14
        );
        case!("<block slot='a'></block>", r#"<block slot="a"/>"#);
        case!("<block slot:a-b></block>", r#"<block slot:aB/>"#);
        case!(
            "<block let:a-b='{{a}}'>{{ aB }}</block>",
            r#"<block let:aB="{{a}}">{{aB}}</block>"#
        );
    }

    #[test]
    fn for_list() {
        case!(
            "<block wx:for='{{ a }}' wx:for-item />",
            r#"<block wx:for="{{a}}" wx:for-item/>"#,
            ParseErrorKind::InvalidScopeName,
            35..35
        );
        case!(
            "<block wx:for='{{ a }}'> abc </block>",
            r#"<block wx:for="{{a}}"> abc </block>"#
        );
        case!(
            "<block wx:for='{{ a }}'> <!-- abc --> <div> abc </div> </block>",
            r#"<div wx:for="{{a}}"> abc </div>"#
        );
        case!(
            "<block wx:for='{{ a }}'> <div let:a='{{ 1 }}'> abc </div> </block>",
            r#"<block wx:for="{{a}}"><div let:a="{{1}}"> abc </div></block>"#
        );
        case!(
            "<block wx:for='{{ a }}'> <div slot:a> abc </div> </block>",
            r#"<block wx:for="{{a}}"><div slot:a> abc </div></block>"#
        );
        case!(
            "<div wx:for='{{ a }}'> a </div>",
            r#"<div wx:for="{{a}}"> a </div>"#
        );
        case!(
            "<block wx:for='{{ a }}' wx:for-index='i' wx:for-item='j' wx:key='t'></block>",
            r#"<block wx:for="{{a}}" wx:for-item="j" wx:for-index="i" wx:key="t"/>"#
        );
        case!(
            "<block wx:for='{{ a }}' wx:for-index='i '></block>",
            r#"<block wx:for="{{a}}" wx:for-index="i "/>"#,
            ParseErrorKind::InvalidScopeName,
            38..40
        );
        case!(
            "<block wx:for='{{ a }}' wx:for-item='i '></block>",
            r#"<block wx:for="{{a}}" wx:for-item="i "/>"#,
            ParseErrorKind::InvalidScopeName,
            37..39
        );
        case!(
            "<block wx:for='{{ a }}' wx:key='{{ i }}'></block>",
            r#"<block wx:for="{{a}}" wx:key="{{ i }}"/>"#,
            ParseErrorKind::DataBindingNotAllowed,
            32..39
        );
    }

    #[test]
    fn if_group() {
        case!(
            "<block wx:if='{{a}}'> abc </block>",
            r#"<block wx:if="{{a}}"> abc </block>"#
        );
        case!(
            "<block wx:if='{{a}}'> abc </block><div wx:else/>",
            r#"<block wx:if="{{a}}"> abc </block><div wx:else/>"#
        );
        case!(
            "<block wx:if='{{a}}'> abc </block><div wx:elif='{{ b }}'/>",
            r#"<block wx:if="{{a}}"> abc </block><div wx:elif="{{b}}"/>"#
        );
        case!(
            "<block wx:if='{{a}}'> abc </block><div wx:elif='{{ b }}'/><block wx:else>A</block>",
            r#"<block wx:if="{{a}}"> abc </block><div wx:elif="{{b}}"/><block wx:else>A</block>"#
        );
        case!(
            "<block wx:if='{{a}}'> <div/> </block> <block wx:elif='{{ b }}'> <div/> </block> <block wx:else> <div/> </block>",
            r#"<div wx:if="{{a}}"/><div wx:elif="{{b}}"/><div wx:else/>"#
        );
        case!(
            "<block wx:elif='{{a}}'> abc </block>",
            r#"<block> abc </block>"#,
            ParseErrorKind::InvalidAttribute,
            7..14
        );
        case!(
            "<block wx:else> abc </block>",
            r#"<block> abc </block>"#,
            ParseErrorKind::InvalidAttribute,
            7..14
        );
        case!(
            "<block wx:if=''/><block wx:else=' '/>",
            r#"<block wx:if/><block wx:else/>"#,
            ParseErrorKind::InvalidAttributeValue,
            33..34
        );
        case!(
            "<block wx:if=''/><div wx:for='' wx:else />",
            r#"<block wx:if/><div wx:for/>"#,
            ParseErrorKind::InvalidAttribute,
            32..39
        );
        case!(
            "<block wx:if=''/><include src='a' wx:else />",
            r#"<block wx:if/><block wx:else><include src="a"/></block>"#
        );
        case!(
            "<block wx:if='{{a}}'/> <!--abc--> <block wx:elif /><!----><block wx:else />",
            r#"<block wx:if="{{a}}"/><block wx:elif/><block wx:else/>"#,
            ParseErrorKind::MissingAttributeValue,
            44..48
        );
    }

    #[test]
    fn template() {
        case!(
            "<template />",
            r#"<template is/>"#,
            ParseErrorKind::MissingModuleName,
            9..9
        );
        case!(
            "<template a='' is='a' />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            10..11
        );
        case!(
            "<template is='a' data='{{ ...a }}' /><template name='a'> abc </template>",
            r#"<template name="a"> abc </template><template is="a" data="{{{...a}}}"/>"#
        );
        case!(
            "<template name='a' is='a' />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..21
        );
        case!(
            "<template name='a' data='{{ ...a }}' />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..23
        );
        case!(
            "<template is='a' data='  ' />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttributeValue,
            23..25
        );
        case!(
            "<template is='a' data='{{ a }} ' />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttributeValue,
            23..31
        );
        case!(
            "<template name='a'/><template name='a'/>",
            r#"<template name="a"/>"#,
            ParseErrorKind::DuplicatedName,
            36..37
        );
        case!(
            "<template name='a' wx:for='' />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..25
        );
        case!(
            "<template name='a' wx:if='' />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..24
        );
        case!(
            "<template is='a'><div/></template>",
            r#"<template is="a"/>"#,
            ParseErrorKind::ChildNodesNotAllowed,
            17..23
        );
        case!(
            "<template   is='a' bind:a />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            24..25
        );
        case!(
            "<template   is='a' mark:a />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            24..25
        );
        case!(
            "<template   is='a' slot='a' />",
            r#"<template is="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..23
        );
        case!(
            "<template name='a' bind:a />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            24..25
        );
        case!(
            "<template name='a' mark:a />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            24..25
        );
        case!(
            "<template name='a' slot='a' />",
            r#"<template name="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            19..23
        );
    }

    #[test]
    fn include() {
        case!(
            "<include/>",
            r#"<block/>"#,
            ParseErrorKind::MissingSourcePath,
            1..8
        );
        case!("<include src='a' />", r#"<include src="a"/>"#);
        case!(
            "<include src='a' src />",
            r#"<include src="a"/>"#,
            ParseErrorKind::DuplicatedAttribute,
            17..20
        );
        case!(
            "<include a='' src='a' />",
            r#"<include src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            9..10
        );
        case!(
            "<include src='a'><div/></include>",
            r#"<include src="a"/>"#,
            ParseErrorKind::ChildNodesNotAllowed,
            17..23
        );
        case!("<include src='a.wxml'></include>", r#"<include src="a"/>"#);
        case!(
            "<include src='a' catch:a />",
            r#"<include src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            23..24
        );
        case!(
            "<include src='a' mark:a />",
            r#"<include src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            22..23
        );
        case!(
            "<include src='a' slot='a' />",
            r#"<include src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            17..21
        );
    }

    #[test]
    fn slot() {
        case!("<slot a-b='a'></slot>", r#"<slot aB="a"/>"#);
        case!(
            "<slot><div/></slot>",
            r#"<slot/>"#,
            ParseErrorKind::ChildNodesNotAllowed,
            6..12
        );
        case!("<slot mut-bind:a />", r#"<slot mut-bind:a/>"#);
        case!("<slot data-a />", r#"<slot data-a/>"#);
        case!("<slot data:a='abc' />", r#"<slot data:a="abc"/>"#);
        case!("<slot mark:a />", r#"<slot mark:a/>"#);
        case!("<slot slot='a' />", r#"<slot slot="a"/>"#);
    }

    #[test]
    fn import() {
        case!("<import src='a' />", r#"<import src="a"/>"#);
        case!(
            "<import src='a' a />",
            r#"<import src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            16..17
        );
        case!(
            "<import src='a' src='b' />",
            r#"<import src="a"/>"#,
            ParseErrorKind::DuplicatedAttribute,
            16..19
        );
        case!("<import />", r#""#, ParseErrorKind::MissingSourcePath, 1..7);
        case!(
            "<import src='a'><div/></import>",
            r#"<import src="a"/>"#,
            ParseErrorKind::ChildNodesNotAllowed,
            16..22
        );
        case!("<import src='a.wxml'></import>", r#"<import src="a"/>"#);
    }

    #[test]
    fn script() {
        case!("<wxs />", r#""#, ParseErrorKind::MissingModuleName, 1..4);
        case!(
            "<wxs module='a'> <wxs></wxsa </wxs>",
            r#"<wxs module="a"> <wxs>< /wxsa </wxs>"#
        );
        case!("<wxs src='a' module='a' />", r#"<wxs module="a" src="a"/>"#);
        case!(
            "<wxs src='a' a module='a' />",
            r#"<wxs module="a" src="a"/>"#,
            ParseErrorKind::InvalidAttribute,
            13..14
        );
        case!(
            "<wxs module='a' /><wxs module='a' src='a' />",
            r#"<wxs module="a"/>"#,
            ParseErrorKind::DuplicatedName,
            31..32
        );
        case!(
            "<wxs src='a' module='a'><div/></wxs>",
            r#"<wxs module="a" src="a"/>"#,
            ParseErrorKind::ChildNodesNotAllowed,
            24..30
        );
        case!(
            "<wxs src='a.wxs' module='a'></wxs>",
            r#"<wxs module="a" src="a"/>"#
        );
        case!(
            r#"<b change:abc="{{ modA.fA }}" /><wxs module="a">exports.a = () => {}</wxs>"#,
            r#"<wxs module="a">exports.a = () => {}</wxs><b change:abc="{{modA.fA}}"/>"#
        );
    }

    #[test]
    fn parsing_line_col() {
        let (_, ps) = crate::parse::parse("TEST", "<wxs module='a'>\n\n'字'</wxs><div");
        assert_eq!(
            ps.warnings().next().unwrap().location,
            Position {
                line: 2,
                utf16_col: 9
            }..Position {
                line: 2,
                utf16_col: 10
            },
        );
        let (_, ps) = crate::parse::parse("TEST", "{{ \n '' + \n'字'}}<div");
        assert_eq!(
            ps.warnings().next().unwrap().location,
            Position {
                line: 2,
                utf16_col: 5
            }..Position {
                line: 2,
                utf16_col: 6
            },
        );
    }

    fn check_with_mangling(src: &str, expect: &str) {
        use crate::stringify::Stringify;
        let (template, ps) = crate::parse::parse("TEST", src);
        assert_eq!(ps.warnings().next(), None);
        let options = crate::stringify::StringifyOptions {
            mangling: true,
            minimize: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", Some(src), options);
        template.stringify_write(&mut stringifier).unwrap();
        let (stringify_result, _sourcemap) = stringifier.finish();
        assert_eq!(stringify_result.as_str(), expect);
    }

    #[test]
    fn for_if_scope() {
        let src = r#"<block wx:if="{{ item }}" wx:for="{{ item }}">{{ index }}</block>"#;
        let expect = r#"<block wx:for="{{item}}" wx:for-item="_$0" wx:for-index="_$1"><block wx:if="{{_$0}}">{{_$1}}</block></block>"#;
        check_with_mangling(src, expect);
    }

    #[test]
    fn for_scope() {
        let src = r#"
            <div wx:for="{{list}}" hidden="{{item}}" change:hidden="{{item}}" data:a="{{index}}"/>
        "#;
        let expect = r#"<div wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1" hidden="{{_$0}}" change:hidden="{{_$0}}" data:a="{{_$1}}"/>"#;
        check_with_mangling(src, expect);
        let src = r#"
            <block wx:for="{{list}}">
                <div wx:for="{{item}}" />
            </block>
        "#;
        let expect = r#"<block wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1"><div wx:for="{{_$0}}" wx:for-item="_$2" wx:for-index="_$3"/></block>"#;
        check_with_mangling(src, expect);
        let src = r#"
            <block wx:for="{{list}}">
                <block wx:if="{{item}}" />
            </block>
        "#;
        let expect = r#"<block wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1"><block wx:if="{{_$0}}"/></block>"#;
        check_with_mangling(src, expect);
        let src = r#"
            <template wx:for="{{list}}" is="{{index}}" data="{{item}}" />
        "#;
        let expect = r#"<block wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1"><template is="{{_$1}}" data="{{{item:_$0}}}"/></block>"#;
        check_with_mangling(src, expect);
        let src = r#"
            <include wx:for="{{list}}" src="a" />
        "#;
        let expect = r#"<block wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1"><include src="a"/></block>"#;
        check_with_mangling(src, expect);
        let src = r#"
            <slot wx:for="{{list}}" name="{{index}}" />
        "#;
        let expect =
            r#"<slot wx:for="{{list}}" wx:for-item="_$0" wx:for-index="_$1" name="{{_$1}}"/>"#;
        check_with_mangling(src, expect);
    }

    #[test]
    fn slot_value_ref_scope() {
        let src = r#"<div slot:a slot:b="c" data:a="{{ a + b + c }}">{{ a + b + c }}</div>"#;
        let expect = r#"<div slot:a="_$0" slot:b="_$1" data:a="{{_$0+b+_$1}}">{{_$0+b+_$1}}</div>"#;
        check_with_mangling(src, expect);
    }

    #[test]
    fn let_var_scope() {
        let src = r#"<div let:c="{{ a + b }}" let:d="{{ c }}">{{ c + d }}</div>"#;
        let expect = r#"<div let:_$0="{{a+b}}" let:_$1="{{_$0}}">{{_$0+_$1}}</div>"#;
        check_with_mangling(src, expect);
    }

    #[test]
    fn mix_slot_value_ref_and_let_var_scope() {
        let src = r#"<div let:c="{{ a + b }}" slot:a>{{ c + a }}</div>"#;
        let expect = r#"<div slot:a="_$0" let:_$1="{{_$0+b}}">{{_$1+_$0}}</div>"#;
        check_with_mangling(src, expect);
    }
}

use std::collections::HashMap;

use compact_str::CompactString;

use crate::binding_map::BindingMapCollector;

use super::{TemplateStructure, ParseState, ParseError};

#[derive(Debug, Clone)]
pub struct Template {
    pub path: String,
    pub content: Vec<Node>,
    pub globals: TemplateGlobals,
    pub binding_map_collector: BindingMapCollector,
}

pub struct TemplateGlobals {
    pub imports: Vec<String>,
    pub includes: Vec<String>,
    pub sub_templates: HashMap<String, Vec<Node>>,
    pub scripts: Vec<Script>,
}

impl Template {
    pub(super) fn parse(path: &str, ps: &mut ParseState) -> Self {
        let mut globals = TemplateGlobals {
            imports: Vec::with_capacity(0),
            includes: Vec::with_capacity(0),
            sub_templates: Vec::with_capacity(0),
            scripts: Vec::with_capacity(0),
        };
        let mut content = vec![];
        Node::parse_vec_node(ps, &mut globals, &mut content);
        let ret = Template {
            path: path.to_string(),
            content: vec![],
            globals,
            binding_map_collector: BindingMapCollector::new(),
        };
        Ok(ret)
    }
}

#[derive(Debug, Clone)]
pub enum Node {
    Text(Value),
    NormalElement {
        tag_name: CompactString,
        attributes: Vec<Attribute>,
        class: ClassAttribute,
        style: StyleAttribute,
        children: Vec<Node>,
        generics: HashMap<CompactString, CompactString>,
        extra_attr: HashMap<CompactString, CompactString>,
        slot: Value,
        slot_value_refs: Vec<(CompactString, CompactString)>,
    },
    Pure {
        children: Vec<Node>,
        slot: Value,
    },
    For {
        list: Value,
        item_name: CompactString,
        index_name: CompactString,
        key: CompactString,
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
        path: CompactString,
        slot: Value,
    },
    Slot {
        name: Value,
        values: Vec<Attribute>,
    },
}

impl Node {
    fn parse_vec_node(ps: &mut ParseState, globals: &mut TemplateGlobals, ret: &mut Vec<Node>) {
        let Some(peek) = ps.peek() else { return };
        match peek {
            '<' => {
                debug_assert_eq!(ps.next(), Some("<"));
                
                // parse tag
                // TODO
            }
            _ => {
                
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct Attribute {
    name: CompactString,
    value: Value,
}

#[derive(Debug, Clone)]
pub enum ClassAttribute {
    String(Value),
    Static(Vec<CompactString>),
    Multiple(Attribute),
}

#[derive(Debug, Clone)]
pub enum StyleAttribute {
    String(Value),
    Static(Vec<CompactString>),
    Multiple(Attribute),
}

#[derive(Debug, Clone)]
pub enum Value {
    Static(CompactString),
    Dynamic {
        expr: Box<Expr>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

//! The parsed node tree structure

use crate::binding_map::{BindingMapCollector, BindingMapKeys};
use crate::escape::{escape_html_text, gen_lit_str};
use crate::proc_gen::{JsExprWriter, JsFunctionScopeWriter, JsIdent, ScopeVar};
use std::collections::HashMap;
use std::fmt;
use std::fmt::Write;

use super::*;

fn dash_to_camel(s: &str) -> String {
    let mut camel_name = String::new();
    let mut next_upper = false;
    for c in s.chars() {
        if c == '-' {
            next_upper = true;
        } else if next_upper {
            next_upper = false;
            camel_name.push_str(&c.to_uppercase().to_string());
        } else {
            camel_name.push(c);
        }
    }
    camel_name
}

/// A parsed template.
#[derive(Debug)]
pub struct TmplTree {
    pub(crate) path: String,
    pub(crate) root: TmplElement,
    pub(crate) imports: Vec<String>,
    pub(crate) includes: Vec<String>,
    pub(crate) sub_templates: HashMap<String, TmplElement>,
    pub(crate) binding_map_collector: BindingMapCollector,
    pub(crate) scripts: Vec<TmplScript>,
}

#[derive(Debug)]
pub(crate) enum TmplNode {
    TextNode(TmplTextNode),
    Element(TmplElement),
}

#[derive(Debug)]
pub(crate) enum TmplTextNode {
    Static(String),
    Dynamic {
        expr: Box<TmplExpr>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

#[derive(Debug)]
pub(crate) struct TmplElement {
    pub(crate) virtual_type: TmplVirtualType,
    pub(crate) tag_name: String,
    pub(crate) attrs: Vec<TmplAttr>,
    pub(crate) children: Vec<TmplNode>,
    pub(crate) generics: Option<HashMap<String, String>>,
    pub(crate) extra_attr: Option<HashMap<String, String>>,
    pub(crate) slot: Option<TmplAttrValue>,
    pub(crate) slot_values: Vec<(String, String)>,
}

#[derive(Debug)]
pub(crate) enum TmplVirtualType {
    None,
    Pure,
    For {
        list: TmplAttrValue,
        item_name: String,
        index_name: String,
        key: Option<String>,
    },
    IfGroup,
    If {
        cond: TmplAttrValue,
    },
    Elif {
        cond: TmplAttrValue,
    },
    Else,
    TemplateRef {
        target: TmplAttrValue,
        data: TmplAttrValue,
    },
    Include {
        path: String,
    },
    Slot {
        name: TmplAttrValue,
        props: Option<Vec<TmplAttr>>,
    },
}

#[derive(Debug)]
pub(crate) struct TmplAttr {
    pub(crate) kind: TmplAttrKind,
    pub(crate) value: TmplAttrValue,
}

#[derive(Debug)]
pub(crate) enum TmplAttrKind {
    WxDirective {
        name: String,
    },
    Generic {
        name: String,
    },
    Slot,
    SlotProperty {
        name: String,
    },
    Id,
    Class,
    Style,
    PropertyOrExternalClass {
        name: String,
    },
    ModelProperty {
        name: String,
    },
    Data {
        name: String,
    },
    Mark {
        name: String,
    },
    Event {
        capture: bool,
        catch: bool,
        mut_bind: bool,
        name: String,
    },
}

#[derive(Debug)]
pub(crate) enum TmplAttrValue {
    Static(String),
    Dynamic {
        expr: Box<TmplExpr>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

#[derive(Debug)]
pub(crate) enum TmplScript {
    Inline {
        module_name: String,
        content: String,
    },
    GlobalRef {
        module_name: String,
        rel_path: String,
    },
}

impl TmplTree {
    pub(crate) fn new() -> Self {
        Self {
            path: String::new(),
            root: TmplElement::new("", TmplVirtualType::None),
            imports: vec![],
            includes: vec![],
            sub_templates: HashMap::new(),
            binding_map_collector: BindingMapCollector::new(),
            scripts: vec![],
        }
    }

    #[allow(dead_code)]
    pub(crate) fn root(&self) -> &TmplElement {
        &self.root
    }

    pub(crate) fn root_mut(&mut self) -> &mut TmplElement {
        &mut self.root
    }

    pub(crate) fn get_direct_dependencies(&self) -> Vec<String> {
        let mut ret = vec![];
        for target_path in self.imports.iter() {
            ret.push(path::resolve(&self.path, target_path));
        }
        for target_path in self.includes.iter() {
            ret.push(path::resolve(&self.path, target_path));
        }
        ret
    }

    pub(crate) fn get_script_dependencies(&self) -> Vec<String> {
        let mut ret = vec![];
        for script in self.scripts.iter() {
            match script {
                TmplScript::GlobalRef { rel_path, .. } => {
                    let abs_path = crate::group::path::resolve(&self.path, &rel_path);
                    ret.push(abs_path);
                }
                TmplScript::Inline { .. } => {}
            }
        }
        ret
    }

    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsExprWriter<W>,
        group: &TmplGroup,
    ) -> Result<(), TmplError> {
        w.paren(|w| {
            w.function(|w| {
                w.expr_stmt(|w| {
                    write!(w, "var P={}", gen_lit_str(&self.path))?;
                    Ok(())
                })?;
                w.expr_stmt(|w| {
                    write!(w, "var H={{}}")?;
                    Ok(())
                })?;
                w.expr_stmt(|w| {
                    write!(w, "var I={{}}")?;
                    Ok(())
                })?;
                for target_path in self.imports.iter() {
                    let p = path::resolve(&self.path, target_path);
                    if let Ok(target_tree) = group.get_tree(&p) {
                        for k in target_tree.sub_templates.keys() {
                            let k = gen_lit_str(k);
                            w.expr_stmt(|w| {
                                write!(
                                    w,
                                    r#"I[{}]=function(R,C,D,U){{return G[{}]({})(R,C,D,U)}}"#,
                                    k,
                                    gen_lit_str(&p),
                                    k
                                )?;
                                Ok(())
                            })?;
                        }
                    } else {
                        // FIXME warn no target file
                    }
                }
                let write_template_item =
                    |key,
                     w: &mut JsFunctionScopeWriter<W>,
                     scopes: &mut Vec<ScopeVar>,
                     bmc: &BindingMapCollector,
                     children: &Vec<TmplNode>| {
                        w.expr_stmt(|w| {
                            write!(w, "H[{key}]=I[{key}]=", key = gen_lit_str(key))?;
                            w.function_args("R,C,D,U", |w| {
                                macro_rules! declare_shortcut {
                                    ($d:expr, $v:expr) => {
                                        w.expr_stmt(|w| {
                                            write!(w, "var {}=R.{}", $d, $v)?;
                                            Ok(())
                                        })?;
                                    };
                                }
                                declare_shortcut!("L", "c");
                                declare_shortcut!("M", "m");
                                declare_shortcut!("O", "r");
                                w.expr_stmt(|w| {
                                    write!(w, "var A={{")?;
                                    for (index, (key, size)) in bmc.list_fields().enumerate() {
                                        if index > 0 {
                                            write!(w, ",")?;
                                        }
                                        write!(w, "{}:new Array({})", gen_lit_str(key), size)?;
                                    }
                                    write!(w, "}}")?;
                                    Ok(())
                                })?;
                                w.expr_stmt(|w| {
                                    write!(w, "var K=U===true")?;
                                    Ok(())
                                })?;
                                w.expr_stmt(|w| {
                                    write!(w, "return {{C:")?;
                                    TmplNode::to_proc_gen_define_children(
                                        children, w, scopes, bmc, group, &self.path,
                                    )?;
                                    write!(w, ",B:A")?;
                                    write!(w, "}}")?;
                                    Ok(())
                                })?;
                                Ok(())
                            })?;
                            Ok(())
                        })
                    };
                let scopes = &mut vec![];
                for script in &self.scripts {
                    let ident = w.gen_ident();
                    match script {
                        TmplScript::GlobalRef { module_name: _, rel_path } => {
                            let abs_path = crate::group::path::resolve(&self.path, &rel_path);
                            w.expr_stmt(|w| {
                                write!(w, r#"var {}=R[{}]()"#, ident, gen_lit_str(&abs_path))?;
                                Ok(())
                            })?;
                        }
                        TmplScript::Inline { module_name: _, content } => {
                            w.expr_stmt(|w| {
                                write!(w, "var {}={}", ident, content)?;
                                Ok(())
                            })?;
                        }
                    }
                    scopes.push(ScopeVar { var: ident, update_path_tree: None, lvalue_path: None })
                }
                for (k, v) in self.sub_templates.iter() {
                    let bmc = BindingMapCollector::new();
                    write_template_item(k, w, scopes, &bmc, &v.children)?;
                }
                write_template_item(
                    "",
                    w,
                    scopes,
                    &self.binding_map_collector,
                    &self.root.children,
                )?;
                w.expr_stmt(|w| {
                    write!(w, "return function(P){{return H[P]}}")?;
                    Ok(())
                })?;
                Ok(())
            })
        })?;
        w.paren(|_| Ok(()))?;
        Ok(())
    }
}

impl fmt::Display for TmplTree {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let import_strings: Vec<String> = self
            .imports
            .iter()
            .map(|x| format!(r#"<import src="{}"></import>"#, escape_html_text(x)))
            .collect();
        let sub_template_strings: Vec<String> = self
            .sub_templates
            .iter()
            .map(|(k, v)| {
                let children_strings: Vec<String> =
                    v.children.iter().map(|c| format!("{}", c)).collect();
                format!(
                    r#"<template name="{}">{}</template>"#,
                    escape_html_text(k),
                    children_strings.join("")
                )
            })
            .collect();
        let children_strings: Vec<String> = self
            .root
            .children
            .iter()
            .map(|c| format!("{}", c))
            .collect();
        write!(
            f,
            "{}{}{}",
            import_strings.join(""),
            sub_template_strings.join(""),
            children_strings.join("")
        )
    }
}

impl TmplNode {
    fn to_proc_gen_function_args(list: &[Self], with_slot_values: bool) -> &'static str {
        #[repr(u8)]
        #[derive(Clone, Copy)]
        enum ArgLevel {
            None = 0,
            TextNode = 1,
            Element = 2,
            IfGroup = 3,
            ForLoop = 4,
            Slot = 5,
            PureVirtualNode = 6,
            WithSlotValues = 7,
        }
        let mut overall_level = ArgLevel::None;
        if with_slot_values {
            overall_level = ArgLevel::WithSlotValues;
        } else {
            fn match_child(c: &TmplNode, overall_level: &mut ArgLevel) {
                let level = match c {
                    TmplNode::TextNode(_) => ArgLevel::TextNode,
                    TmplNode::Element(n) => match &n.virtual_type {
                        TmplVirtualType::None => ArgLevel::Element,
                        TmplVirtualType::IfGroup { .. } => ArgLevel::IfGroup,
                        TmplVirtualType::If { .. }
                        | TmplVirtualType::Elif { .. }
                        | TmplVirtualType::Else => {
                            for c in n.children.iter() {
                                match_child(c, overall_level);
                            }
                            ArgLevel::None
                        }
                        TmplVirtualType::For { .. } => ArgLevel::ForLoop,
                        TmplVirtualType::Slot { .. } => ArgLevel::Slot,
                        TmplVirtualType::TemplateRef { .. } => ArgLevel::IfGroup,
                        _ => ArgLevel::PureVirtualNode,
                    },
                };
                if (*overall_level as u8) < (level as u8) {
                    *overall_level = level;
                }
            }
            for c in list.iter() {
                match_child(c, &mut overall_level);
            }
        }
        match overall_level {
            ArgLevel::None => "C",
            ArgLevel::TextNode => "C,T",
            ArgLevel::Element => "C,T,E",
            ArgLevel::IfGroup => "C,T,E,B",
            ArgLevel::ForLoop => "C,T,E,B,F",
            ArgLevel::Slot => "C,T,E,B,F,S",
            ArgLevel::PureVirtualNode => "C,T,E,B,F,S,J",
            ArgLevel::WithSlotValues => "C,T,E,B,F,S,J,V,W",
        }
    }

    fn to_proc_gen_define_children_content<W: std::fmt::Write>(
        list: &[Self],
        var_slot_map: HashMap<String, (JsIdent, JsIdent)>,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        bmc: &BindingMapCollector,
        group: &TmplGroup,
        cur_path: &str,
    ) -> Result<HashMap<String, (JsIdent, JsIdent)>, TmplError> {
        for c in list.iter() {
            match c {
                TmplNode::TextNode(c) => {
                    c.to_proc_gen(w, scopes, bmc)?;
                }
                TmplNode::Element(c) => {
                    let mut slot_value_count = 0;
                    for (slot_value_name, _) in c.slot_values.iter() {
                        if let Some((var_scope, var_update_path_tree)) =
                            var_slot_map.get(slot_value_name)
                        {
                            slot_value_count += 1;
                            scopes.push(ScopeVar {
                                var: var_scope.clone(),
                                update_path_tree: Some(var_update_path_tree.clone()),
                                lvalue_path: None,
                            });
                        }
                    }
                    c.to_proc_gen(w, scopes, bmc, group, cur_path)?;
                    for _ in 0..slot_value_count {
                        scopes.pop();
                    }
                }
            }
        }
        Ok(var_slot_map)
    }

    fn to_proc_gen_define_children<W: std::fmt::Write>(
        list: &[Self],
        w: &mut JsExprWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        bmc: &BindingMapCollector,
        group: &TmplGroup,
        cur_path: &str,
    ) -> Result<HashMap<String, (JsIdent, JsIdent)>, TmplError> {
        let mut has_slot_values = false;
        for item in list {
            match item {
                TmplNode::TextNode(..) => {}
                TmplNode::Element(elem) => {
                    if elem.slot_values.len() > 0 {
                        has_slot_values = true;
                        break;
                    }
                }
            }
        }
        let args = TmplNode::to_proc_gen_function_args(list, has_slot_values);
        w.function_args(args, |w| {
            let mut var_slot_map = HashMap::new();
            if has_slot_values {
                for item in list {
                    match item {
                        TmplNode::TextNode(..) => {}
                        TmplNode::Element(elem) => {
                            for (slot_value_name, _) in elem.slot_values.iter() {
                                let var_scope = w.gen_ident();
                                let var_update_path_tree = w.gen_ident();
                                w.expr_stmt(|w| {
                                    write!(w, "var {}=X(V).{}", var_scope, slot_value_name)?;
                                    Ok(())
                                })?;
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "var {}=C?!0:W.{}",
                                        var_update_path_tree, slot_value_name
                                    )?;
                                    Ok(())
                                })?;
                                var_slot_map.insert(
                                    slot_value_name.to_string(),
                                    (var_scope, var_update_path_tree),
                                );
                            }
                        }
                    }
                }
            }
            let var_slot_map = TmplNode::to_proc_gen_define_children_content(
                list,
                var_slot_map,
                w,
                scopes,
                bmc,
                group,
                cur_path,
            )?;
            Ok(var_slot_map)
        })
    }
}

impl fmt::Display for TmplNode {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            TmplNode::TextNode(n) => write!(f, "{}", n),
            TmplNode::Element(n) => write!(f, "{}", n),
        }
    }
}

impl TmplElement {
    pub(crate) fn new(tag_name: &str, virtual_type: TmplVirtualType) -> Self {
        Self {
            virtual_type,
            tag_name: String::from(tag_name),
            attrs: vec![],
            children: vec![],
            generics: None,
            extra_attr: None,
            slot: None,
            slot_values: Vec::with_capacity(0),
        }
    }

    pub(crate) fn add_attr(&mut self, name: &str, value: TmplAttrValue) {
        let kind = if let Some((prefix, name)) = name.split_once(':') {
            let name = name.to_string();
            match prefix {
                "wx" => TmplAttrKind::WxDirective { name },
                "generic" => TmplAttrKind::Generic { name },
                "slot" => TmplAttrKind::SlotProperty {
                    name: dash_to_camel(&name),
                },
                "model" => TmplAttrKind::ModelProperty {
                    name: dash_to_camel(&name),
                },
                "data" => TmplAttrKind::Data { name },
                "bind" => TmplAttrKind::Event {
                    capture: false,
                    catch: false,
                    mut_bind: false,
                    name,
                },
                "mut-bind" => TmplAttrKind::Event {
                    capture: false,
                    catch: false,
                    mut_bind: true,
                    name,
                },
                "catch" => TmplAttrKind::Event {
                    capture: false,
                    catch: true,
                    mut_bind: false,
                    name,
                },
                "capture-bind" => TmplAttrKind::Event {
                    capture: true,
                    catch: false,
                    mut_bind: false,
                    name,
                },
                "capture-mut-bind" => TmplAttrKind::Event {
                    capture: true,
                    catch: false,
                    mut_bind: true,
                    name,
                },
                "capture-catch" => TmplAttrKind::Event {
                    capture: true,
                    catch: true,
                    mut_bind: false,
                    name,
                },
                "mark" => TmplAttrKind::Mark { name },
                _ => {
                    // TODO warn unknown attr
                    return;
                }
            }
        } else {
            match name {
                "slot" => TmplAttrKind::Slot,
                "id" => TmplAttrKind::Id,
                "class" => TmplAttrKind::Class,
                "style" => TmplAttrKind::Style,
                name if name.starts_with("data-") => {
                    let camel_name = dash_to_camel(&name[5..]);
                    TmplAttrKind::Data { name: camel_name }
                }
                name => TmplAttrKind::PropertyOrExternalClass {
                    name: name.to_string(),
                },
            }
        };
        self.attrs.push(TmplAttr { kind, value });
    }

    pub(crate) fn append_text_node(&mut self, child: TmplTextNode) {
        self.children.push(TmplNode::TextNode(child));
    }

    pub(crate) fn append_element(&mut self, child: TmplElement) {
        self.children.push(TmplNode::Element(child));
    }

    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        bmc: &BindingMapCollector,
        group: &TmplGroup,
        cur_path: &str,
    ) -> Result<(), TmplError> {
        match &self.virtual_type {
            TmplVirtualType::None => {
                enum SlotKind<'a> {
                    None,
                    Static(&'a str),
                    Dynamic(TmplExprProcGen),
                }
                let slot_kind = match &self.slot {
                    None => SlotKind::None,
                    Some(TmplAttrValue::Static(v)) => SlotKind::Static(v.as_str()),
                    Some(TmplAttrValue::Dynamic { expr, .. }) => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        SlotKind::Dynamic(p)
                    }
                };
                w.expr_stmt(|w| {
                    write!(w, "E({},{{", gen_lit_str(&self.tag_name),)?;
                    if let Some(generics) = self.generics.as_ref() {
                        for (i, (k, v)) in generics.iter().enumerate() {
                            if i > 0 {
                                write!(w, ",")?;
                            }
                            write!(w, "{}:{}", gen_lit_str(k), gen_lit_str(v))?;
                        }
                    }
                    write!(w, "}},")?;
                    w.function_args("N,C", |w| {
                        if let Some(ea) = self.extra_attr.as_ref() {
                            for (k, v) in ea.iter() {
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "N.setAttribute({},{})",
                                        gen_lit_str(k),
                                        gen_lit_str(v)
                                    )?;
                                    Ok(())
                                })?;
                            }
                        }
                        for attr in self.attrs.iter() {
                            attr.to_proc_gen(w, scopes, bmc)?;
                        }
                        if let SlotKind::Dynamic(p) = &slot_kind {
                            if let Some(TmplAttrValue::Dynamic { binding_map_keys, .. }) = &self.slot {
                                if let Some(binding_map_keys) = binding_map_keys {
                                    if !binding_map_keys.is_empty(bmc) {
                                        binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                            w.expr_stmt(|w| {
                                                write!(w, "R.s(N,")?;
                                                p.value_expr(w)?;
                                                write!(w, ")")?;
                                                Ok(())
                                            })
                                        })?;
                                    }
                                }
                            }
                        }
                        Ok(())
                    })?;
                    write!(w, ",")?;
                    let var_slot_map = TmplNode::to_proc_gen_define_children(
                        &self.children,
                        w,
                        scopes,
                        bmc,
                        group,
                        cur_path,
                    )?;
                    if self.slot.is_some() || var_slot_map.len() > 0 {
                        write!(w, ",")?;
                        match slot_kind {
                            SlotKind::None => write!(w, "undefined")?,
                            SlotKind::Static(s) => write!(w, "{}", gen_lit_str(s))?,
                            SlotKind::Dynamic(p) => p.value_expr(w)?,
                        }
                        if var_slot_map.len() > 0 {
                            write!(w, ",[")?;
                            for (index, name) in var_slot_map.keys().enumerate() {
                                if index > 0 {
                                    write!(w, ",")?;
                                }
                                write!(w, "{}", gen_lit_str(name))?;
                            }
                            write!(w, "]")?;
                        }
                    }
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::Pure => {
                enum SlotKind<'a> {
                    None,
                    Static(&'a str),
                    Dynamic(TmplExprProcGen),
                }
                let mut slot_kind = SlotKind::None;
                if let Some(slot) = &self.slot {
                    match &slot {
                        TmplAttrValue::Static(x) => {
                            slot_kind = SlotKind::Static(x.as_str());
                        }
                        TmplAttrValue::Dynamic { expr, .. } => {
                            let p = expr.to_proc_gen_prepare(w, scopes)?;
                            slot_kind = SlotKind::Dynamic(p);
                        }
                    }
                }
                w.expr_stmt(|w| {
                    write!(w, "J(")?;
                    TmplNode::to_proc_gen_define_children(
                        &self.children,
                        w,
                        scopes,
                        bmc,
                        group,
                        cur_path,
                    )?;
                    match slot_kind {
                        SlotKind::None => {}
                        SlotKind::Static(x) => {
                            write!(w, r#",{}"#, gen_lit_str(x))?;
                        }
                        SlotKind::Dynamic(p) => {
                            write!(w, r#",Y("#)?;
                            p.value_expr(w)?;
                            write!(w, r#")"#)?;
                        }
                    }
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::IfGroup => {
                let var_branch_index = w.gen_ident();
                enum CondItem<'a> {
                    None,
                    Static(&'a str),
                    Dynamic(TmplExprProcGen),
                }
                let mut cond_list = Vec::with_capacity(self.children.len());
                for branch in self.children.iter() {
                    let item = match branch {
                        TmplNode::Element(elem) => match &elem.virtual_type {
                            TmplVirtualType::If { cond } | TmplVirtualType::Elif { cond } => {
                                match cond {
                                    TmplAttrValue::Static(v) => CondItem::Static(v.as_str()),
                                    TmplAttrValue::Dynamic { expr, .. } => {
                                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                                        CondItem::Dynamic(p)
                                    }
                                }
                            }
                            TmplVirtualType::Else => CondItem::None,
                            _ => unreachable!(),
                        },
                        TmplNode::TextNode(..) => {
                            unreachable!()
                        }
                    };
                    cond_list.push(item);
                }
                w.expr_stmt(|w| {
                    write!(w, "var {}=", var_branch_index)?;
                    for (index, branch) in cond_list.into_iter().enumerate() {
                        match branch {
                            CondItem::None => {
                                break;
                            }
                            CondItem::Static(v) => {
                                write!(w, "{}?{}:", gen_lit_str(&v), index + 1)?;
                            }
                            CondItem::Dynamic(p) => {
                                p.value_expr(w)?;
                                write!(w, "?{}:", index + 1)?;
                            }
                        }
                    }
                    write!(w, "0")?;
                    Ok(())
                })?;
                w.expr_stmt(|w| {
                    write!(w, "B({},", var_branch_index)?;
                    let args = format!(
                        "{}",
                        TmplNode::to_proc_gen_function_args(&self.children, false)
                    );
                    w.function_args(&args, |w| {
                        w.expr_stmt(|w| {
                            for (index, branch) in self.children.iter().enumerate() {
                                match branch {
                                    TmplNode::Element(elem) => {
                                        match &elem.virtual_type {
                                            TmplVirtualType::If { .. } => {
                                                write!(
                                                    w,
                                                    "if({}==={})",
                                                    var_branch_index,
                                                    index + 1
                                                )?;
                                            }
                                            TmplVirtualType::Elif { .. } => {
                                                write!(
                                                    w,
                                                    "else if({}==={})",
                                                    var_branch_index,
                                                    index + 1
                                                )?;
                                            }
                                            TmplVirtualType::Else => {
                                                write!(w, "else")?;
                                            }
                                            _ => unreachable!(),
                                        }
                                        w.brace_block(|w| {
                                            TmplNode::to_proc_gen_define_children_content(
                                                &elem.children,
                                                HashMap::with_capacity(0),
                                                w,
                                                scopes,
                                                bmc,
                                                group,
                                                cur_path,
                                            )?;
                                            Ok(())
                                        })?;
                                    }
                                    TmplNode::TextNode(..) => {
                                        unreachable!()
                                    }
                                }
                            }
                            Ok(())
                        })?;
                        Ok(())
                    })?;
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::If { .. } | TmplVirtualType::Elif { .. } | TmplVirtualType::Else => {
                unreachable!()
            }
            TmplVirtualType::For { list, key, .. } => {
                enum ListExpr {
                    Static(String),
                    Dynamic(TmplExprProcGen),
                }
                let list_expr: ListExpr;
                match list {
                    TmplAttrValue::Static(v) => {
                        list_expr = ListExpr::Static(v.to_string());
                    }
                    TmplAttrValue::Dynamic { expr, .. } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        list_expr = ListExpr::Dynamic(p);
                    }
                }
                let var_scope_item = w.gen_ident();
                let var_scope_index = w.gen_ident();
                let var_scope_item_update_path_tree = w.gen_ident();
                let var_scope_index_update_path_tree = w.gen_ident();
                let var_scope_item_lvalue_path = w.gen_ident();
                w.expr_stmt(|w| {
                    write!(w, "F(")?;
                    match &list_expr {
                        ListExpr::Static(v) => {
                            write!(w, r#"{},null,undefined,null,"#, gen_lit_str(&v))?;
                        }
                        ListExpr::Dynamic(p) => {
                            p.value_expr(w)?;
                            write!(
                                w,
                                ",{},U?",
                                match key {
                                    Some(key) => gen_lit_str(key),
                                    None => "null".into(),
                                }
                            )?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, ":undefined,")?;
                            p.lvalue_path(w, scopes)?;
                            write!(w, ",")?;
                        }
                    }
                    let args = TmplNode::to_proc_gen_function_args(&self.children, false)
                        .trim_start_matches("C");
                    let children_args = format!(
                        "C,{},{},{},{},{}{}",
                        var_scope_item,
                        var_scope_index,
                        var_scope_item_update_path_tree,
                        var_scope_index_update_path_tree,
                        var_scope_item_lvalue_path,
                        args,
                    );
                    w.function_args(&children_args, |w| {
                        scopes.push(ScopeVar {
                            var: var_scope_item,
                            update_path_tree: Some(var_scope_item_update_path_tree),
                            lvalue_path: Some(var_scope_item_lvalue_path),
                        });
                        scopes.push(ScopeVar {
                            var: var_scope_index,
                            update_path_tree: Some(var_scope_index_update_path_tree),
                            lvalue_path: None,
                        });
                        TmplNode::to_proc_gen_define_children_content(
                            &self.children,
                            HashMap::with_capacity(0),
                            w,
                            scopes,
                            bmc,
                            group,
                            cur_path,
                        )?;
                        scopes.pop();
                        scopes.pop();
                        Ok(())
                    })?;
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::TemplateRef { target, data } => {
                let var_key = w.gen_ident();
                match target {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "var {}={}", var_key, gen_lit_str(v.as_str()))?;
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic { expr, .. } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "var {}=", var_key)?;
                            p.value_expr(w)?;
                            Ok(())
                        })?;
                    }
                }
                w.expr_stmt(|w| {
                    write!(w, "B({},", var_key)?;
                    w.function_args("C,T,E,B,F,S,J", |w| {
                        let var_target = w.gen_ident();
                        w.expr_stmt(|w| {
                            write!(w, "var {}=I[{}]", var_target, var_key)?;
                            Ok(())
                        })?;
                        match data {
                            TmplAttrValue::Static(v) => w.expr_stmt(|w| {
                                write!(
                                    w,
                                    "if({}&&{}){}(R,C,{},undefined).C(C,T,E,B,F,S,J)",
                                    var_key,
                                    var_target,
                                    var_target,
                                    gen_lit_str(v)
                                )?;
                                Ok(())
                            }),
                            TmplAttrValue::Dynamic { expr, .. } => {
                                let p = expr.to_proc_gen_prepare(w, scopes)?;
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "if({}&&{}){}(R,C,",
                                        var_key, var_target, var_target
                                    )?;
                                    p.value_expr(w)?;
                                    write!(w, ",U?")?;
                                    p.lvalue_state_expr(w, scopes)?;
                                    write!(w, ":undefined).C(C,T,E,B,F,S,J)")?;
                                    Ok(())
                                })
                            }
                        }
                    })?;
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::Include { path: rel_path } => {
                let var_key = w.gen_ident();
                let normalized_path = path::resolve(cur_path, rel_path);
                w.expr_stmt(|w| {
                    write!(w, "J(")?;
                    w.function_args("C,T,E,B,F,S,J", |w| {
                        w.expr_stmt(|w| {
                            write!(w, "var {}=G[{}]", var_key, gen_lit_str(&normalized_path))?;
                            Ok(())
                        })?;
                        w.expr_stmt(|w| {
                            write!(
                                w,
                                "if({}){}('')(R,C,D,U).C(C,T,E,B,F,S,J)",
                                var_key, var_key
                            )?;
                            Ok(())
                        })?;
                        Ok(())
                    })?;
                    write!(w, ")")?;
                    Ok(())
                })?;
            }
            TmplVirtualType::Slot { name, props } => {
                let slot_value_init = if let Some(props) = props {
                    let var_slot_value_init = w.gen_ident();
                    w.expr_stmt(|w| {
                        write!(w, "var {}=", var_slot_value_init)?;
                        w.function_args("N", |w| {
                            for prop in props {
                                match &prop.kind {
                                    TmplAttrKind::PropertyOrExternalClass { name } => {
                                        let name = &dash_to_camel(name);
                                        match &prop.value {
                                            TmplAttrValue::Static(x) => {
                                                w.expr_stmt(|w| {
                                                    write!(
                                                        w,
                                                        r#"if(C)R.l(N,{},{})"#,
                                                        gen_lit_str(&name),
                                                        gen_lit_str(x)
                                                    )?;
                                                    Ok(())
                                                })?;
                                            }
                                            TmplAttrValue::Dynamic { expr, .. } => {
                                                let p = expr.to_proc_gen_prepare(w, scopes)?;
                                                w.expr_stmt(|w| {
                                                    write!(w, "if(C||K||")?;
                                                    p.lvalue_state_expr(w, scopes)?;
                                                    write!(w, ")R.l(N,{},", gen_lit_str(&name))?;
                                                    p.value_expr(w)?;
                                                    write!(w, ")")?;
                                                    Ok(())
                                                })?;
                                            }
                                        }
                                    }
                                    _ => {
                                        // TODO warn unused attr
                                    }
                                }
                            }
                            Ok(())
                        })?;
                        Ok(())
                    })?;
                    format!("{}", var_slot_value_init)
                } else {
                    String::new()
                };
                match name {
                    TmplAttrValue::Static(x) => {
                        w.expr_stmt(|w| {
                            if slot_value_init.len() > 0 {
                                write!(
                                    w,
                                    r#"C?S({},{init}):S(undefined,{init})"#,
                                    gen_lit_str(&x),
                                    init = slot_value_init
                                )?;
                            } else {
                                write!(w, r#"C?S({}):S()"#, gen_lit_str(&x))?;
                            }
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic { expr, .. } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, r#"C||K||"#)?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, r#"?S(Y("#)?;
                            p.value_expr(w)?;
                            if slot_value_init.len() > 0 {
                                write!(w, r#"),{init}):S({init})"#, init = slot_value_init)?;
                            } else {
                                write!(w, r#")):S()"#)?;
                            }
                            Ok(())
                        })?;
                    }
                }
            }
        }
        Ok(())
    }
}

impl fmt::Display for TmplElement {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let virtual_string: String = match &self.virtual_type {
            TmplVirtualType::None => "".into(),
            TmplVirtualType::Pure => "".into(),
            TmplVirtualType::IfGroup => {
                let children_strings: Vec<String> =
                    self.children.iter().map(|c| format!("{}", c)).collect();
                return write!(f, "{}", children_strings.join(""));
            }
            TmplVirtualType::If { cond } => format!(r#" wx:if={}"#, cond),
            TmplVirtualType::Elif { cond } => format!(r#" wx:elif={}"#, cond),
            TmplVirtualType::Else => " wx:else".into(),
            TmplVirtualType::For {
                list,
                item_name,
                index_name,
                key,
            } => {
                let list = format!(r#" wx:for={}"#, list);
                let item = format!(r#" wx:for-item="{}""#, escape_html_text(item_name));
                let index = format!(r#" wx:for-index="{}""#, escape_html_text(index_name));
                let key = if let Some(key) = key {
                    format!(r#" wx:key="{}""#, escape_html_text(key))
                } else {
                    String::new()
                };
                list + &item + &index + &key
            }
            TmplVirtualType::TemplateRef { target, data } => {
                format!(r#" is={} data={}"#, target, data)
            }
            TmplVirtualType::Include { path } => format!(r#" src="{}""#, escape_html_text(path)),
            TmplVirtualType::Slot { name, props } => {
                let name = format!(r#" name={}"#, name);
                let props = if let Some(props) = props {
                    let prop_strings: Vec<String> =
                        props.iter().map(|prop| format!(" {}", prop)).collect();
                    prop_strings.join("")
                } else {
                    String::new()
                };
                name + &props
            }
        };
        let attr_strings: Vec<String> =
            self.attrs.iter().map(|attr| format!(" {}", attr)).collect();
        let children_strings: Vec<String> =
            self.children.iter().map(|c| format!("{}", c)).collect();
        let generics_seg = {
            self.generics
                .as_ref()
                .map(|list| {
                    list.iter()
                        .map(|(k, v)| format!(" generic:{}={}", k, v))
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default()
        };
        let slot_props_seg = if self.slot_values.len() > 0 {
            let props: Vec<String> = self
                .slot_values
                .iter()
                .map(|(capture_name, provide_name)| {
                    format!(r#" slot:{}="{}""#, capture_name, provide_name)
                })
                .collect();
            props.join("")
        } else {
            String::new()
        };
        let extra_attr_seg = {
            self.extra_attr
                .as_ref()
                .map(|list| {
                    list.iter()
                        .map(|(k, v)| format!(" extra-attr:{}={}", k, v))
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default()
        };
        write!(
            f,
            "<{}{}{}{}{}{}>{}</{}>",
            &self.tag_name,
            virtual_string,
            attr_strings.join(""),
            generics_seg,
            slot_props_seg,
            extra_attr_seg,
            children_strings.join(""),
            &self.tag_name
        )
    }
}

impl TmplAttr {
    pub(crate) fn is_property(&self, n: &str) -> bool {
        match &self.kind {
            TmplAttrKind::PropertyOrExternalClass { name } if name.as_str() == n => true,
            _ => false,
        }
    }

    pub(crate) fn is_any_property(&self) -> bool {
        match &self.kind {
            TmplAttrKind::PropertyOrExternalClass { .. } => true,
            _ => false,
        }
    }

    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        macro_rules! write_value {
            ($t:expr) => {
                match &self.value {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "if(C){}(N,{})", $t, gen_lit_str(v))?;
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic {
                        expr,
                        binding_map_keys,
                    } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "if(C||K||")?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, "){}(N,", $t)?;
                            p.value_expr(w)?;
                            write!(w, ")")?;
                            Ok(())
                        })?;
                        if let Some(binding_map_keys) = binding_map_keys {
                            if !binding_map_keys.is_empty(bmc) {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "{}(N,", $t)?;
                                        p.value_expr(w)?;
                                        write!(w, ")")?;
                                        Ok(())
                                    })
                                })?;
                            }
                        }
                    }
                }
            };
            ($t:expr, $n:expr) => {
                match &self.value {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "if(C){}(N,{},{})", $t, $n, gen_lit_str(v))?;
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic {
                        expr,
                        binding_map_keys,
                    } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "if(C||K||")?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, "){}(N,{},", $t, $n)?;
                            p.value_expr(w)?;
                            write!(w, ")")?;
                            Ok(())
                        })?;
                        if let Some(binding_map_keys) = binding_map_keys {
                            if !binding_map_keys.is_empty(bmc) {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "{}(N,{},", $t, $n)?;
                                        p.value_expr(w)?;
                                        write!(w, ")")?;
                                        Ok(())
                                    })?;
                                    w.expr_stmt(|w| {
                                        write!(w, "E(N)")?;
                                        Ok(())
                                    })
                                })?;
                            }
                        }
                    }
                }
            };
        }
        match &self.kind {
            TmplAttrKind::WxDirective { .. }
            | TmplAttrKind::Generic { .. }
            | TmplAttrKind::Slot
            | TmplAttrKind::SlotProperty { .. } => unreachable!(),
            TmplAttrKind::Id => {
                write_value!("R.i");
            }
            TmplAttrKind::Class => {
                write_value!("L");
            }
            TmplAttrKind::Style => {
                write_value!("R.y");
            }
            TmplAttrKind::ModelProperty { name }
            | TmplAttrKind::PropertyOrExternalClass { name } => {
                let attr_name = gen_lit_str(&name);
                match &self.value {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "if(C)O(N,{},{})", attr_name, gen_lit_str(v))?;
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic {
                        expr,
                        binding_map_keys,
                    } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "if(C||K||")?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, ")O(N,{},", attr_name)?;
                            p.value_expr(w)?;
                            if let TmplAttrKind::ModelProperty { .. } = &self.kind {
                                write!(w, ",")?;
                                p.lvalue_path(w, scopes)?;
                            }
                            write!(w, ")")?;
                            Ok(())
                        })?;
                        if let Some(binding_map_keys) = binding_map_keys {
                            if !binding_map_keys.is_empty(bmc) {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "O(N,{},", attr_name)?;
                                        p.value_expr(w)?;
                                        if let TmplAttrKind::ModelProperty { .. } = &self.kind {
                                            write!(w, ",")?;
                                            p.lvalue_path(w, scopes)?;
                                        }
                                        write!(w, ")")?;
                                        Ok(())
                                    })?;
                                    w.expr_stmt(|w| {
                                        write!(w, "E(N)")?;
                                        Ok(())
                                    })
                                })?;
                            }
                        }
                    }
                }
            }
            TmplAttrKind::Data { name } => {
                write_value!("R.d", gen_lit_str(name));
            }
            TmplAttrKind::Mark { name } => {
                write_value!("M", gen_lit_str(name));
            }
            TmplAttrKind::Event {
                capture,
                catch,
                mut_bind,
                name,
            } => match &self.value {
                TmplAttrValue::Static(v) => {
                    w.expr_stmt(|w| {
                        write!(
                            w,
                            "if(C)R.v(N,{},{},{},{},{},!1)",
                            gen_lit_str(name),
                            gen_lit_str(v),
                            if *catch { "!0" } else { "!1" },
                            if *mut_bind { "!0" } else { "!1" },
                            if *capture { "!0" } else { "!1" },
                        )?;
                        Ok(())
                    })?;
                }
                TmplAttrValue::Dynamic {
                    expr,
                    binding_map_keys,
                } => {
                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                    w.expr_stmt(|w| {
                        write!(w, "if(C||K||")?;
                        p.lvalue_state_expr(w, scopes)?;
                        write!(w, ")R.v(N,{},", gen_lit_str(name),)?;
                        p.value_expr(w)?;
                        write!(
                            w,
                            ",{},{},{},!0)",
                            if *catch { "!0" } else { "!1" },
                            if *mut_bind { "!0" } else { "!1" },
                            if *capture { "!0" } else { "!1" },
                        )?;
                        Ok(())
                    })?;
                    if let Some(binding_map_keys) = binding_map_keys {
                        if !binding_map_keys.is_empty(bmc) {
                            binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                let p = expr.to_proc_gen_prepare(w, scopes)?;
                                w.expr_stmt(|w| {
                                    write!(w, "R.v(N,{},", gen_lit_str(name))?;
                                    p.value_expr(w)?;
                                    write!(
                                        w,
                                        ",{},{},{},!0)",
                                        if *catch { "!0" } else { "!1" },
                                        if *mut_bind { "!0" } else { "!1" },
                                        if *capture { "!0" } else { "!1" },
                                    )?;
                                    Ok(())
                                })
                            })?;
                        }
                    }
                }
            },
        }
        Ok(())
    }
}

impl fmt::Display for TmplAttr {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let s = match &self.kind {
            TmplAttrKind::WxDirective { name } => format!("wx:{}", name),
            TmplAttrKind::Generic { name } => format!("generic:{}", name),
            TmplAttrKind::Slot => format!("slot"),
            TmplAttrKind::SlotProperty { name } => format!("{}", name),
            TmplAttrKind::Id => format!("id"),
            TmplAttrKind::Class => format!("class"),
            TmplAttrKind::Style => format!("style"),
            TmplAttrKind::PropertyOrExternalClass { name } => format!("{}", name),
            TmplAttrKind::ModelProperty { name } => format!("model:{}", name),
            TmplAttrKind::Data { name } => format!("data:{}", name),
            TmplAttrKind::Event {
                capture,
                catch,
                mut_bind,
                name,
            } => {
                let capture_prefix = if *capture { "capture-" } else { "" };
                let main_prefix = if *catch {
                    "catch"
                } else if *mut_bind {
                    "mut-bind"
                } else {
                    "bind"
                };
                format!("{}{}-{}", capture_prefix, main_prefix, name)
            }
            TmplAttrKind::Mark { name } => format!("mark:{}", name),
        };
        write!(f, "{}={}", &s, &self.value)
    }
}

impl TmplAttrValue {
    pub(crate) fn static_value(self) -> String {
        match self {
            TmplAttrValue::Static(s) => s,
            TmplAttrValue::Dynamic { .. } => {
                // TODO warn disallow non-static string value
                String::new()
            }
        }
    }
}

impl fmt::Display for TmplAttrValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            TmplAttrValue::Static(v) => {
                write!(f, "\"{}\"", escape_html_text(v))
            }
            TmplAttrValue::Dynamic { expr, .. } => {
                write!(f, "\"{{{{{}}}}}\"", expr)
            }
        }
    }
}

impl TmplTextNode {
    pub(crate) fn new_static(content: String) -> Self {
        TmplTextNode::Static(content)
    }

    pub(crate) fn new_dynamic(expr: Box<TmplExpr>) -> Self {
        TmplTextNode::Dynamic {
            expr,
            binding_map_keys: None,
        }
    }

    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        // create fn for text node
        match self {
            TmplTextNode::Static(x) => w.expr_stmt(|w| {
                write!(w, r#"C?T({}):T()"#, gen_lit_str(&x))?;
                Ok(())
            }),
            TmplTextNode::Dynamic {
                expr,
                binding_map_keys,
            } => {
                let p = expr.to_proc_gen_prepare(w, scopes)?;
                w.expr_stmt(|w| {
                    write!(w, r#"C||K||"#)?;
                    p.lvalue_state_expr(w, scopes)?;
                    write!(w, r#"?T(Y("#)?;
                    p.value_expr(w)?;
                    write!(w, r#")"#)?;
                    if let Some(binding_map_keys) = binding_map_keys {
                        if !binding_map_keys.is_empty(bmc) {
                            write!(w, r#","#)?;
                            w.function_args("N", |w| {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "T(N,Y(")?;
                                        p.value_expr(w)?;
                                        write!(w, "))")?;
                                        Ok(())
                                    })
                                })
                            })?;
                        }
                    }
                    write!(w, r#"):T()"#)?;
                    Ok(())
                })?;
                Ok(())
            }
        }
    }
}

impl fmt::Display for TmplTextNode {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            TmplTextNode::Static(v) => {
                write!(f, "{}", escape_html_text(v))
            }
            TmplTextNode::Dynamic { expr, .. } => {
                write!(f, "{{{{{}}}}}", expr)
            }
        }
    }
}

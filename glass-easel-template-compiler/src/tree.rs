//! The parsed node tree structure

use crate::binding_map::{BindingMapCollector, BindingMapKeys};
use crate::escape::{escape_html_text, gen_lit_str, dash_to_camel};
use crate::proc_gen::{
    JsExprWriter, JsFunctionScopeWriter, JsIdent, JsTopScopeWriter, ScopeVar, ScopeVarLvaluePath,
};
use std::collections::HashMap;
use std::fmt;
use std::fmt::Write;

use super::*;

/// A parsed template.
#[derive(Debug, Clone)]
pub struct TmplTree {
    pub(crate) path: String,
    pub(crate) root: TmplElement,
    pub(crate) imports: Vec<String>,
    pub(crate) includes: Vec<String>,
    pub(crate) sub_templates: HashMap<String, TmplElement>,
    pub(crate) binding_map_collector: BindingMapCollector,
    pub(crate) scripts: Vec<TmplScript>,
}

#[derive(Debug, Clone)]
pub(crate) enum TmplNode {
    TextNode(TmplTextNode),
    Element(TmplElement),
}

#[derive(Debug, Clone)]
pub(crate) enum TmplTextNode {
    Static(String),
    Dynamic {
        expr: Box<TmplExpr>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
pub(crate) struct TmplLocation {
    pub(crate) start: usize,
    pub(crate) end: usize,
}

#[derive(Debug, Clone)]
pub(crate) struct TmplAttr {
    pub(crate) kind: TmplAttrKind,
    pub(crate) value: TmplAttrValue,
    pub(crate) loc: Option<TmplLocation>
}

#[derive(Debug, Clone)]
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
    ChangeProperty {
        name: String,
    },
    WorkletProperty {
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

#[derive(Debug, Clone)]
pub(crate) enum TmplAttrValue {
    Static(String),
    Dynamic {
        expr: Box<TmplExpr>,
        binding_map_keys: Option<BindingMapKeys>,
    },
}

#[derive(Debug, Clone)]
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

    pub(crate) fn get_inline_script_module_names(&self) -> Vec<String> {
        let mut ret = vec![];
        for script in self.scripts.iter() {
            match script {
                TmplScript::GlobalRef { .. } => {}
                TmplScript::Inline { module_name, .. } => {
                    ret.push(module_name.to_string());
                }
            }
        }
        ret
    }

    pub(crate) fn get_inline_script(&self, module_name: &str) -> Option<&str> {
        for script in self.scripts.iter() {
            match script {
                TmplScript::GlobalRef { .. } => {}
                TmplScript::Inline { module_name: m, content } => {
                    if module_name == m {
                        return Some(&content);
                    }
                }
            }
        }
        None
    }

    pub(crate) fn set_inline_script(&mut self, module_name: &str, new_content: &str) {
        match self.scripts.iter_mut().find(|script| match script {
            TmplScript::GlobalRef { .. } => false,
            TmplScript::Inline { module_name: m, .. } => module_name == m,
        }) {
            Some(script) => {
                if let TmplScript::Inline {
                    ref mut content, ..
                } = script
                {
                    *content = String::from(new_content)
                }
            }
            None => self.scripts.push(TmplScript::Inline {
                module_name: String::from(module_name),
                content: String::from(new_content),
            }),
        }
    }

    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsExprWriter<W>,
        group: &TmplGroup,
    ) -> Result<(), TmplError> {
        w.paren(|w| {
            w.function(|w| {
                w.expr_stmt(|w| {
                    write!(w, "var H={{}}")?;
                    Ok(())
                })?;
                w.expr_stmt(|w| {
                    write!(w, "var S")?;
                    Ok(())
                })?;
                w.expr_stmt(|w| {
                    write!(w, "var I=")?;
                    w.function_args("P", |w| {
                        w.expr_stmt(|w| {
                            write!(w, "if(!S)S=Object.assign({{}}")?;
                            for target_path in self.imports.iter() {
                                let p = path::resolve(&self.path, target_path);
                                write!(w, ",G[{}]._", gen_lit_str(&p))?;
                            }
                            write!(w, ",H)")?;
                            Ok(())
                        })?;
                        w.expr_stmt(|w| {
                            write!(w, "return S[P]")?;
                            Ok(())
                        })
                    })
                })?;
                let write_template_item =
                    |key,
                     w: &mut JsFunctionScopeWriter<W>,
                     scopes: &mut Vec<ScopeVar>,
                     bmc: &BindingMapCollector,
                     children: &Vec<TmplNode>,
                     has_scripts: bool| {
                        w.expr_stmt(|w| {
                            write!(w, "H[{key}]=", key = gen_lit_str(key))?;
                            w.function_args("R,C,D,U", |w| {
                                if has_scripts {
                                    w.expr_stmt(|w| {
                                        write!(w, "R.setFnFilter(Q.A,Q.B)")?;
                                        Ok(())
                                    })?;
                                }
                                let mut writer = JsTopScopeWriter::new(String::new());
                                writer.align(w);
                                let define_root_ident = writer.function_scope(|w| {
                                    macro_rules! declare_shortcut {
                                        ($d:expr, $v:expr) => {
                                            w.set_var_on_top_scope_init($d, |w| {
                                                write!(w, $v)?;
                                                Ok(())
                                            })?;
                                        };
                                    }
                                    declare_shortcut!("L", "R.c");
                                    declare_shortcut!("M", "R.m");
                                    declare_shortcut!("O", "R.r");
                                    w.set_var_on_top_scope_init("A", |w| {
                                        write!(w, "{{")?;
                                        for (index, (key, size)) in bmc.list_fields().enumerate() {
                                            if index > 0 {
                                                write!(w, ",")?;
                                            }
                                            write!(w, "{}:new Array({})", gen_lit_str(key), size)?;
                                        }
                                        write!(w, "}}")?;
                                        Ok(())
                                    })?;
                                    declare_shortcut!("K", "U===true");
                                    w.declare_var_on_top_scope_init(|w, define_root_ident| {
                                        TmplNode::to_proc_gen_define_children(
                                            &mut children.iter(),
                                            w,
                                            scopes,
                                            |args, w, var_slot_map, scopes| {
                                                w.function_args(args, |w| {
                                                    TmplNode::to_proc_gen_define_children_content(
                                                        &children,
                                                        &var_slot_map,
                                                        w,
                                                        scopes,
                                                        bmc,
                                                        group,
                                                        &self.path,
                                                    )
                                                })
                                            },
                                        )?;
                                        Ok(define_root_ident)
                                    })
                                })?;
                                w.expr_stmt(|w| {
                                    write!(w, "{}", &writer.finish())?;
                                    Ok(())
                                })?;
                                w.expr_stmt(|w| {
                                    write!(w, "return {{C:{},B:A}}", define_root_ident)?;
                                    Ok(())
                                })?;
                                Ok(())
                            })
                        })
                    };
                let scopes = &mut vec![];
                let has_scripts = if self.scripts.len() > 0 {
                    for script in &self.scripts {
                        let ident = w.gen_ident();
                        let lvalue_path = match script {
                            TmplScript::GlobalRef {
                                module_name: _,
                                rel_path,
                            } => {
                                let abs_path = crate::group::path::resolve(&self.path, &rel_path);
                                w.expr_stmt(|w| {
                                    write!(w, r#"var {}=R[{}]()"#, ident, gen_lit_str(&abs_path))?;
                                    Ok(())
                                })?;
                                ScopeVarLvaluePath::Script { abs_path }
                            }
                            TmplScript::Inline {
                                module_name,
                                content,
                            } => {
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "var {}=D('{}#{}',(require,exports,module)=>{{{}}})()",
                                        ident, &self.path, module_name, content
                                    )?;
                                    Ok(())
                                })?;
                                ScopeVarLvaluePath::InlineScript {
                                    path: self.path.clone(),
                                    mod_name: module_name.clone(),
                                }
                            }
                        };
                        scopes.push(ScopeVar {
                            var: ident,
                            update_path_tree: None,
                            lvalue_path,
                        })
                    }
                    true
                } else {
                    false
                };
                for (k, v) in self.sub_templates.iter() {
                    let bmc = BindingMapCollector::new();
                    write_template_item(k, w, scopes, &bmc, &v.children, has_scripts)?;
                }
                write_template_item(
                    "",
                    w,
                    scopes,
                    &self.binding_map_collector,
                    &self.root.children,
                    has_scripts,
                )?;
                w.expr_stmt(|w| {
                    write!(
                        w,
                        "return Object.assign(function(R){{return H[R]}},{{_:H}})"
                    )?;
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
    fn to_proc_gen_function_args<'a>(
        list_iter: &mut (impl IntoIterator<Item = &'a TmplNode> + Clone),
        with_slot_values: bool,
    ) -> &'static str {
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
            for c in list_iter.clone().into_iter() {
                match_child(&c, &mut overall_level);
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
        var_slot_map: &Option<HashMap<String, (JsIdent, JsIdent)>>,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        bmc: &BindingMapCollector,
        group: &TmplGroup,
        cur_path: &str,
    ) -> Result<(), TmplError> {
        if let Some(var_slot_map) = var_slot_map {
            for (slot_value_name, (var_scope, var_update_path_tree)) in var_slot_map.iter() {
                w.expr_stmt(|w| {
                    write!(
                        w,
                        "{}=X(V).{},{}=C?!0:W.{}",
                        var_scope, slot_value_name, var_update_path_tree, slot_value_name
                    )?;
                    Ok(())
                })?;
            }
        }
        for c in list.iter() {
            match c {
                TmplNode::TextNode(c) => {
                    c.to_proc_gen(w, scopes, bmc)?;
                }
                TmplNode::Element(c) => {
                    let mut slot_value_count = 0;
                    for (slot_value_name, _) in c.slot_values.iter() {
                        if let Some(var_slot_map) = var_slot_map {
                            if let Some((var_scope, var_update_path_tree)) =
                                var_slot_map.get(slot_value_name)
                            {
                                slot_value_count += 1;
                                scopes.push(ScopeVar {
                                    var: var_scope.clone(),
                                    update_path_tree: Some(var_update_path_tree.clone()),
                                    lvalue_path: ScopeVarLvaluePath::Invalid,
                                });
                            }
                        }
                    }
                    c.to_proc_gen(w, scopes, bmc, group, cur_path)?;
                    for _ in 0..slot_value_count {
                        scopes.pop();
                    }
                }
            }
        }
        Ok(())
    }

    fn to_proc_gen_define_children<'a, W: std::fmt::Write>(
        list_iter: &mut (impl IntoIterator<Item = &'a TmplNode> + Clone),
        w: &mut JsExprWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        f: impl FnOnce(
            &str,
            &mut JsExprWriter<W>,
            &Option<HashMap<String, (JsIdent, JsIdent)>>,
            &mut Vec<ScopeVar>,
        ) -> Result<(), TmplError>,
    ) -> Result<Option<HashMap<String, (JsIdent, JsIdent)>>, TmplError> {
        let mut var_slot_map: Option<HashMap<String, (JsIdent, JsIdent)>> = None;
        for item in list_iter.clone().into_iter() {
            match item {
                TmplNode::TextNode(..) => {}
                TmplNode::Element(elem) => {
                    for (slot_value_name, _) in elem.slot_values.iter() {
                        if var_slot_map.is_none() {
                            var_slot_map = Some(HashMap::new());
                        }
                        let var_slot_map = var_slot_map.as_mut().unwrap();
                        if !var_slot_map.contains_key(slot_value_name) {
                            let var_scope = w.declare_var_on_top_scope()?;
                            let var_update_path_tree = w.declare_var_on_top_scope()?;
                            var_slot_map.insert(
                                slot_value_name.to_string(),
                                (var_scope, var_update_path_tree),
                            );
                        }
                    }
                }
            }
        }
        let args = TmplNode::to_proc_gen_function_args(list_iter, var_slot_map.is_some());
        f(args, w, &var_slot_map, scopes)?;
        Ok(var_slot_map)
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
            slot_values: vec![],
        }
    }

    pub(crate) fn tag_name_is(&self, tag_name: &str) -> bool {
        self.tag_name == tag_name
    }

    pub(crate) fn add_attr(&mut self, name: &str, value: TmplAttrValue, loc: Option<TmplLocation>) {
        let kind = if let Some((prefix, name)) = name.split_once(':') {
            let name = name.to_string();
            match prefix {
                "wx" => TmplAttrKind::WxDirective { name },
                "generic" => TmplAttrKind::Generic { name: name.to_ascii_lowercase() },
                "slot" => TmplAttrKind::SlotProperty {
                    name: dash_to_camel(&name.to_ascii_lowercase()),
                },
                "model" => TmplAttrKind::ModelProperty {
                    name: dash_to_camel(&name),
                },
                "change" => TmplAttrKind::ChangeProperty {
                    name: dash_to_camel(&name),
                },
                "worklet" => TmplAttrKind::WorkletProperty {
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
                    let camel_name = dash_to_camel(&name[5..].to_ascii_lowercase());
                    TmplAttrKind::Data { name: camel_name }
                }
                name => TmplAttrKind::PropertyOrExternalClass {
                    name: name.to_string(),
                },
            }
        };
        self.attrs.push(TmplAttr { kind, value, loc });
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
                let slot_kind = SlotKind::new(&self.slot, w, scopes)?;
                let (child_ident, var_slot_map) =
                    w.declare_var_on_top_scope_init(|w, ident| {
                        let var_slot_map = TmplNode::to_proc_gen_define_children(
                            &mut self.children.iter(),
                            w,
                            scopes,
                            |args, w, var_slot_map, scopes| {
                                w.function_args(args, |w| {
                                    TmplNode::to_proc_gen_define_children_content(
                                        &self.children,
                                        &var_slot_map,
                                        w,
                                        scopes,
                                        bmc,
                                        group,
                                        cur_path,
                                    )
                                })
                            },
                        )?;
                        Ok((ident, var_slot_map))
                    })?;
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
                    write!(w, ",{}", child_ident)?;
                    if self.slot.is_some() || var_slot_map.is_some() {
                        write!(w, ",")?;
                        match slot_kind {
                            SlotKind::None => write!(w, "undefined")?,
                            SlotKind::Static(s) => write!(w, "{}", gen_lit_str(s))?,
                            SlotKind::Dynamic(p) => p.value_expr(w)?,
                        }
                        if let Some(var_slot_map) = var_slot_map {
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
                    }
                    write!(w, ")")?;
                    Ok(())
                })
            }
            TmplVirtualType::Pure => {
                let slot_kind = SlotKind::new(&self.slot, w, scopes)?;
                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
                    TmplNode::to_proc_gen_define_children(
                        &mut self.children.iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
                            w.function_args(args, |w| {
                                TmplNode::to_proc_gen_define_children_content(
                                    &self.children,
                                    &var_slot_map,
                                    w,
                                    scopes,
                                    bmc,
                                    group,
                                    cur_path,
                                )
                            })
                        },
                    )?;
                    Ok(ident)
                })?;
                w.expr_stmt(|w| {
                    write!(w, "J({}", child_ident)?;
                    slot_kind.write_as_extra_argument(w)?;
                    write!(w, ")")?;
                    Ok(())
                })
            }
            TmplVirtualType::IfGroup => {
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
                let var_branch_index = w.declare_var_on_top_scope()?;
                w.expr_stmt(|w| {
                    write!(w, "{}=", var_branch_index)?;
                    for (index, branch) in cond_list.into_iter().enumerate() {
                        match branch {
                            CondItem::None => {
                                break;
                            }
                            CondItem::Static(v) => {
                                write!(w, "{}?{}:", gen_lit_str(&v), index + 1)?;
                            }
                            CondItem::Dynamic(p) => {
                                if p.above_cond_expr() {
                                    w.paren(|w| p.value_expr(w))?;
                                } else {
                                    p.value_expr(w)?;
                                }
                                write!(w, "?{}:", index + 1)?;
                            }
                        }
                    }
                    write!(w, "0")?;
                    Ok(())
                })?;
                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
                    let mut list_iter: Box<dyn Iterator<Item = &TmplNode>> = Box::new([].iter());
                    for branch in self.children.iter() {
                        match branch {
                            TmplNode::TextNode(..) => unreachable!(),
                            TmplNode::Element(elem) => {
                                list_iter = Box::new(list_iter.chain(elem.children.iter()));
                            }
                        }
                    }
                    let list: Vec<&TmplNode> = list_iter.collect();
                    TmplNode::to_proc_gen_define_children(
                        &mut list.into_iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
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
                                                        var_slot_map,
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
                                })
                            })
                        },
                    )?;
                    Ok(ident)
                })?;
                w.expr_stmt(|w| {
                    write!(w, "B({},{})", var_branch_index, child_ident)?;
                    Ok(())
                })
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

                let var_scope_item = w.declare_var_on_top_scope()?;
                let var_scope_index = w.declare_var_on_top_scope()?;
                let var_scope_item_update_path_tree = w.declare_var_on_top_scope()?;
                let var_scope_index_update_path_tree = w.declare_var_on_top_scope()?;
                let var_scope_item_lvalue_path = w.declare_var_on_top_scope()?;

                let arg_scope_item = w.gen_private_ident();
                let arg_scope_index = w.gen_private_ident();
                let arg_scope_item_update_path_tree = w.gen_private_ident();
                let arg_scope_index_update_path_tree = w.gen_private_ident();
                let arg_scope_item_lvalue_path = w.gen_private_ident();

                let lvalue_path_from_data_scope = match &list_expr {
                    ListExpr::Static(_) => None,
                    ListExpr::Dynamic(p) => {
                        let has_model_lvalue_path = p.has_model_lvalue_path(scopes);
                        let has_script_lvalue_path = p.has_script_lvalue_path(scopes);
                        if has_model_lvalue_path && has_script_lvalue_path {
                            // simply drop it if we cannot decide it is script or not
                            // this may happens when conditional expression is used
                            None
                        } else if has_model_lvalue_path {
                            Some(true)
                        } else if has_script_lvalue_path {
                            Some(false)
                        } else {
                            None
                        }
                    }
                };

                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
                    scopes.push(ScopeVar {
                        var: var_scope_item.clone(),
                        update_path_tree: Some(var_scope_item_update_path_tree.clone()),
                        lvalue_path: if let Some(from_data_scope) = lvalue_path_from_data_scope {
                            ScopeVarLvaluePath::Var {
                                var_name: var_scope_item_lvalue_path.clone(),
                                from_data_scope,
                            }
                        } else {
                            ScopeVarLvaluePath::Invalid
                        },
                    });
                    scopes.push(ScopeVar {
                        var: var_scope_index.clone(),
                        update_path_tree: Some(var_scope_index_update_path_tree.clone()),
                        lvalue_path: ScopeVarLvaluePath::Invalid,
                    });
                    TmplNode::to_proc_gen_define_children(
                        &mut self.children.iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
                            let children_args = format!(
                                "C,{},{},{},{},{}{}",
                                arg_scope_item,
                                arg_scope_index,
                                arg_scope_item_update_path_tree,
                                arg_scope_index_update_path_tree,
                                arg_scope_item_lvalue_path,
                                args.trim_start_matches("C"),
                            );
                            w.function_args(&children_args, |w| {
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "{}={},{}={},{}={},{}={},{}={}",
                                        var_scope_item,
                                        arg_scope_item,
                                        var_scope_index,
                                        arg_scope_index,
                                        var_scope_item_update_path_tree,
                                        arg_scope_item_update_path_tree,
                                        var_scope_index_update_path_tree,
                                        arg_scope_index_update_path_tree,
                                        var_scope_item_lvalue_path,
                                        arg_scope_item_lvalue_path,
                                    )?;
                                    Ok(())
                                })?;
                                TmplNode::to_proc_gen_define_children_content(
                                    &self.children,
                                    &var_slot_map,
                                    w,
                                    scopes,
                                    bmc,
                                    group,
                                    cur_path,
                                )
                            })
                        },
                    )?;
                    scopes.pop();
                    scopes.pop();
                    Ok(ident)
                })?;
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
                            if lvalue_path_from_data_scope.is_some() {
                                p.lvalue_path(w, scopes, None)?;
                            } else {
                                write!(w, "null")?;
                            }
                            write!(w, ",")?;
                        }
                    };
                    write!(w, "{})", child_ident)?;
                    Ok(())
                })
            }
            TmplVirtualType::TemplateRef { target, data } => {
                let var_key = w.declare_var_on_top_scope()?;
                match target {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "{}={}", var_key, gen_lit_str(v.as_str()))?;
                            Ok(())
                        })?;
                    }
                    TmplAttrValue::Dynamic { expr, .. } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "{}=", var_key)?;
                            p.value_expr(w)?;
                            Ok(())
                        })?;
                    }
                }
                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
                    w.function_args("C,T,E,B,F,S,J", |w| {
                        let var_target = w.gen_private_ident();
                        w.expr_stmt(|w| {
                            write!(w, "var {}=I({})", var_target, var_key)?;
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
                                    write!(w, ",K||(U?")?;
                                    p.lvalue_state_expr(w, scopes)?;
                                    write!(w, ":undefined)).C(C,T,E,B,F,S,J)")?;
                                    Ok(())
                                })
                            }
                        }
                    })?;
                    Ok(ident)
                })?;
                w.expr_stmt(|w| {
                    write!(w, "B({},", var_key)?;
                    write!(w, "{})", child_ident)?;
                    Ok(())
                })
            }
            TmplVirtualType::Include { path: rel_path } => {
                let var_key = w.gen_private_ident();
                let normalized_path = path::resolve(cur_path, rel_path);
                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
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
                        })
                    })?;
                    Ok(ident)
                })?;
                w.expr_stmt(|w| {
                    write!(w, "J({})", child_ident)?;
                    Ok(())
                })
            }
            TmplVirtualType::Slot { name, props } => {
                let slot_kind = SlotKind::new(&self.slot, w, scopes)?;
                let name = StaticStrOrProcGen::new(name, w, scopes)?;
                w.expr_stmt(|w| {
                    write!(w, "S(")?;
                    match name {
                        StaticStrOrProcGen::Static(s) => {
                            write!(w, "{}", gen_lit_str(s))?;
                        }
                        StaticStrOrProcGen::Dynamic(p) => {
                            write!(w, r#"C||K||"#)?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, r#"?Y("#)?;
                            p.value_expr(w)?;
                            write!(w, "):undefined")?;
                        }
                    }
                    if let Some(props) = props {
                        write!(w, r#","#)?;
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
                                    TmplAttrKind::Event { .. }
                                    | TmplAttrKind::Data { .. }
                                    | TmplAttrKind::Mark { .. } => {
                                        prop.to_proc_gen(w, scopes, bmc)?;
                                    }
                                    _ => {
                                        // TODO warn unused attr
                                    }
                                }
                            }
                            Ok(())
                        })?;
                    } else if !slot_kind.is_none() {
                        write!(w, r#",undefined"#)?;
                    }
                    if !slot_kind.is_none() {
                        slot_kind.write_as_extra_argument(w)?;
                    }
                    write!(w, ")")?;
                    Ok(())
                })
            }
        }
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

    #[allow(dead_code)]
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
        fn maybe_event_binding(name: &str) -> bool {
            name.starts_with("bind")
                || name.starts_with("capture-bind")
                || name.starts_with("catch")
                || name.starts_with("capture-catch")
                || name.starts_with("on")
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
                                if p.has_model_lvalue_path(scopes) {
                                    write!(w, ",")?;
                                    p.lvalue_path(w, scopes, Some(true))?;
                                }
                            } else if maybe_event_binding(&name) {
                                if p.has_script_lvalue_path(scopes) {
                                    write!(w, ",undefined,")?;
                                    p.lvalue_path(w, scopes, Some(false))?;
                                }
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
                                            if p.has_model_lvalue_path(scopes) {
                                                write!(w, ",")?;
                                                p.lvalue_path(w, scopes, Some(true))?;
                                            }
                                        } else if maybe_event_binding(&name) {
                                            if p.has_script_lvalue_path(scopes) {
                                                write!(w, ",undefined,")?;
                                                p.lvalue_path(w, scopes, Some(false))?;
                                            }
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
            TmplAttrKind::ChangeProperty { name } => {
                let attr_name = gen_lit_str(&name);
                match &self.value {
                    TmplAttrValue::Static(_) => {}
                    TmplAttrValue::Dynamic {
                        expr,
                        binding_map_keys,
                    } => {
                        let p = expr.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "if(C||K||")?;
                            p.lvalue_state_expr(w, scopes)?;
                            write!(w, ")R.p(N,{},", attr_name)?;
                            p.value_expr(w)?;
                            if p.has_script_lvalue_path(scopes) {
                                write!(w, ",")?;
                                p.lvalue_path(w, scopes, Some(false))?;
                            }
                            write!(w, ")")?;
                            Ok(())
                        })?;
                        if let Some(binding_map_keys) = binding_map_keys {
                            if !binding_map_keys.is_empty(bmc) {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "R.p(N,{},", attr_name)?;
                                        p.value_expr(w)?;
                                        if p.has_script_lvalue_path(scopes) {
                                            write!(w, ",")?;
                                            p.lvalue_path(w, scopes, Some(false))?;
                                        }
                                        write!(w, ")")?;
                                        Ok(())
                                    })
                                })?;
                            }
                        }
                    }
                }
            }
            TmplAttrKind::WorkletProperty { name } => {
                let attr_name = gen_lit_str(&name);
                match &self.value {
                    TmplAttrValue::Static(v) => {
                        w.expr_stmt(|w| {
                            write!(w, "if(C)R.wl(N,{},{})", attr_name, gen_lit_str(v))?;
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
                            write!(w, ")R.wl(N,{},", attr_name)?;
                            p.value_expr(w)?;
                            write!(w, ")")?;
                            Ok(())
                        })?;
                        if let Some(binding_map_keys) = binding_map_keys {
                            if !binding_map_keys.is_empty(bmc) {
                                binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                                    let p = expr.to_proc_gen_prepare(w, scopes)?;
                                    w.expr_stmt(|w| {
                                        write!(w, "R.wl(N,{},", attr_name)?;
                                        p.value_expr(w)?;
                                        write!(w, ")")?;
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
                            ",{},{},{},!0",
                            if *catch { "!0" } else { "!1" },
                            if *mut_bind { "!0" } else { "!1" },
                            if *capture { "!0" } else { "!1" },
                        )?;
                        if p.has_script_lvalue_path(scopes) {
                            write!(w, ",")?;
                            p.lvalue_path(w, scopes, Some(false))?;
                        }
                        write!(w, ")")?;
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
                                    if p.has_script_lvalue_path(scopes) {
                                        write!(w, ",")?;
                                        p.lvalue_path(w, scopes, Some(false))?;
                                    }
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
            TmplAttrKind::ChangeProperty { name } => format!("change:{}", name),
            TmplAttrKind::WorkletProperty { name } => format!("worklet:{}", name),
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

enum SlotKind<'a> {
    None,
    Static(&'a str),
    Dynamic(TmplExprProcGen),
}

impl<'a> SlotKind<'a> {
    fn new<W: Write>(
        slot: &'a Option<TmplAttrValue>,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
    ) -> Result<Self, TmplError> {
        let this = match slot {
            None => SlotKind::None,
            Some(TmplAttrValue::Static(v)) => SlotKind::Static(v.as_str()),
            Some(TmplAttrValue::Dynamic { expr, .. }) => {
                let p = expr.to_proc_gen_prepare(w, scopes)?;
                SlotKind::Dynamic(p)
            }
        };
        Ok(this)
    }

    fn is_none(&self) -> bool {
        match self {
            SlotKind::None => true,
            SlotKind::Static(_) => false,
            SlotKind::Dynamic(_) => false,
        }
    }

    fn write_as_extra_argument<W: Write>(&self, w: &mut JsExprWriter<W>) -> Result<(), TmplError> {
        match self {
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
        Ok(())
    }
}

enum StaticStrOrProcGen<'a> {
    Static(&'a str),
    Dynamic(TmplExprProcGen),
}

impl<'a> StaticStrOrProcGen<'a> {
    fn new<W: Write>(
        v: &'a TmplAttrValue,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
    ) -> Result<Self, TmplError> {
        let this = match v {
            TmplAttrValue::Static(s) => Self::Static(s.as_str()),
            TmplAttrValue::Dynamic { expr, .. } => {
                let p = expr.to_proc_gen_prepare(w, scopes)?;
                Self::Dynamic(p)
            }
        };
        Ok(this)
    }
}

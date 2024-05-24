use std::{collections::HashMap, fmt::Write, ops::Range};

use super::{
    JsExprWriter, JsFunctionScopeWriter, JsIdent, JsTopScopeWriter, ScopeVar, ScopeVarLvaluePath,
};
use crate::{
    binding_map::BindingMapCollector,
    escape::gen_lit_str,
    parse::{
        tag::{
            Attribute, ClassAttribute, CommonElementAttributes, Element, ElementKind, EventBinding,
            Node, Script, StaticAttribute, StyleAttribute, Value,
        },
        Position, Template,
    },
    proc_gen::expr::ExpressionProcGen,
    TmplError, TmplGroup,
};

impl Template {
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
                            for target_path in self.globals.imports.iter() {
                                let p = crate::path::resolve(&self.path, &target_path.name);
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
                     children: &Vec<Node>,
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
                                        Node::to_proc_gen_define_children(
                                            &mut children.iter(),
                                            w,
                                            scopes,
                                            |args, w, var_slot_map, scopes| {
                                                w.function_args(args, |w| {
                                                    Node::to_proc_gen_define_children_content(
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
                let has_scripts = if self.globals.scripts.len() > 0 {
                    for script in &self.globals.scripts {
                        let ident = w.gen_ident();
                        let lvalue_path = match script {
                            Script::GlobalRef {
                                module_name: _,
                                path,
                            } => {
                                let abs_path = crate::path::resolve(&self.path, &path.name);
                                w.expr_stmt(|w| {
                                    write!(w, r#"var {}=R[{}]()"#, ident, gen_lit_str(&abs_path))?;
                                    Ok(())
                                })?;
                                ScopeVarLvaluePath::Script { abs_path }
                            }
                            Script::Inline {
                                module_name,
                                content,
                                content_location: _,
                            } => {
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "var {}=D('{}#{}',(require,exports,module)=>{{{}}})()",
                                        ident, &self.path, module_name.name, content
                                    )?;
                                    Ok(())
                                })?;
                                ScopeVarLvaluePath::InlineScript {
                                    path: self.path.clone(),
                                    mod_name: module_name.name.to_string(),
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
                for (k, v) in self.globals.sub_templates.iter() {
                    let bmc = BindingMapCollector::new();
                    write_template_item(&k.name, w, scopes, &bmc, &v, has_scripts)?;
                }
                write_template_item(
                    "",
                    w,
                    scopes,
                    &self.globals.binding_map_collector,
                    &self.content,
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

impl Node {
    fn to_proc_gen_function_args<'a>(
        list_iter: &mut (impl IntoIterator<Item = &'a Node> + Clone),
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
            fn match_child(c: &Node, overall_level: &mut ArgLevel) {
                let level = match c {
                    Node::Text(_) => ArgLevel::TextNode,
                    Node::Element(n) => match &n.kind {
                        ElementKind::Normal { .. } => ArgLevel::Element,
                        ElementKind::If { .. } => ArgLevel::IfGroup,
                        ElementKind::For { .. } => ArgLevel::ForLoop,
                        ElementKind::Slot { .. } => ArgLevel::Slot,
                        ElementKind::Pure { .. }
                        | ElementKind::Include { .. }
                        | ElementKind::TemplateRef { .. } => ArgLevel::PureVirtualNode,
                    },
                    Node::Comment(..) | Node::UnknownMetaTag(..) => ArgLevel::None,
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
                Node::Text(c) => match c {
                    Value::Static { value, .. } => {
                        w.expr_stmt(|w| {
                            write!(w, r#"C?T({}):T()"#, gen_lit_str(&value))?;
                            Ok(())
                        })?;
                    }
                    Value::Dynamic {
                        expression,
                        binding_map_keys,
                        double_brace_location: _,
                    } => {
                        let p = expression.to_proc_gen_prepare(w, scopes)?;
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
                                            let p = expression.to_proc_gen_prepare(w, scopes)?;
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
                    }
                },
                Node::Element(c) => {
                    let mut slot_value_count = 0;
                    if let Some(refs) = c.slot_value_refs() {
                        for attr in refs {
                            if let Some(var_slot_map) = var_slot_map {
                                if let Some((var_scope, var_update_path_tree)) =
                                    var_slot_map.get(attr.name.name.as_str())
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
                    }
                    c.to_proc_gen(w, scopes, bmc, group, cur_path)?;
                    for _ in 0..slot_value_count {
                        scopes.pop();
                    }
                }
                Node::Comment(..) | Node::UnknownMetaTag(..) => {}
            }
        }
        Ok(())
    }

    fn to_proc_gen_define_children<'a, W: std::fmt::Write>(
        list_iter: &mut (impl IntoIterator<Item = &'a Node> + Clone),
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
                Node::Text(..) => {}
                Node::Element(elem) => {
                    if let Some(refs) = elem.slot_value_refs() {
                        for attr in refs {
                            if var_slot_map.is_none() {
                                var_slot_map = Some(HashMap::new());
                            }
                            let var_slot_map = var_slot_map.as_mut().unwrap();
                            if !var_slot_map.contains_key(attr.name.name.as_str()) {
                                let var_scope = w.declare_var_on_top_scope()?;
                                let var_update_path_tree = w.declare_var_on_top_scope()?;
                                var_slot_map.insert(
                                    attr.name.name.to_string(),
                                    (var_scope, var_update_path_tree),
                                );
                            }
                        }
                    }
                }
                Node::Comment(..) | Node::UnknownMetaTag(..) => {}
            }
        }
        let args = Node::to_proc_gen_function_args(list_iter, var_slot_map.is_some());
        f(args, w, &var_slot_map, scopes)?;
        Ok(var_slot_map)
    }
}

impl Element {
    pub(crate) fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
        bmc: &BindingMapCollector,
        group: &TmplGroup,
        cur_path: &str,
    ) -> Result<(), TmplError> {
        match &self.kind {
            ElementKind::Normal {
                tag_name,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes,
                data,
                children,
                generics,
                extra_attr,
                common,
            } => {
                let slot_kind = SlotKind::new(&common.slot, w, scopes)?;
                let (child_ident, var_slot_map) = w.declare_var_on_top_scope_init(|w, ident| {
                    let var_slot_map = Node::to_proc_gen_define_children(
                        &mut children.iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
                            w.function_args(args, |w| {
                                Node::to_proc_gen_define_children_content(
                                    &children,
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
                    write!(w, "E({},{{", gen_lit_str(&tag_name.name),)?;
                    if generics.len() > 0 {
                        for (i, attr) in generics.iter().enumerate() {
                            if i > 0 {
                                write!(w, ",")?;
                            }
                            write!(
                                w,
                                "{}:{}",
                                gen_lit_str(&attr.name.name),
                                gen_lit_str(&attr.value.name)
                            )?;
                        }
                    }
                    write!(w, "}},")?;
                    w.function_args("N,C", |w| {
                        if extra_attr.len() > 0 {
                            for attr in extra_attr.iter() {
                                w.expr_stmt(|w| {
                                    write!(
                                        w,
                                        "N.setAttribute({},{})",
                                        gen_lit_str(&attr.name.name),
                                        gen_lit_str(&attr.value.name)
                                    )?;
                                    Ok(())
                                })?;
                            }
                        }
                        match class {
                            ClassAttribute::None => {}
                            ClassAttribute::String(_, value) => {
                                write_attribute_value(w, "L", value, scopes, bmc)?;
                            }
                            ClassAttribute::Multiple(..) => unimplemented!(),
                        }
                        match style {
                            StyleAttribute::None => {}
                            StyleAttribute::String(_, value) => {
                                write_attribute_value(w, "R.y", value, scopes, bmc)?;
                            }
                            StyleAttribute::Multiple(..) => unimplemented!(),
                        }
                        for attr in worklet_attributes.iter() {
                            attr.to_proc_gen_as_worklet_property(w, scopes, bmc)?;
                        }
                        for attr in change_attributes.iter() {
                            attr.to_proc_gen_as_change_property(w, scopes, bmc)?;
                        }
                        for attr in attributes.iter() {
                            attr.to_proc_gen_as_normal(w, scopes, bmc)?;
                        }
                        for attr in data.iter() {
                            attr.to_proc_gen_with_method(w, "R.d", scopes, bmc)?;
                        }
                        common.to_proc_gen_without_slot(w, scopes, bmc)?;
                        if let SlotKind::Dynamic(p) = &slot_kind {
                            if let Some((
                                _,
                                Value::Dynamic {
                                    binding_map_keys, ..
                                },
                            )) = common.slot.as_ref()
                            {
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
                    if common.slot.is_some() || var_slot_map.is_some() {
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
            ElementKind::Pure {
                children,
                slot,
                slot_value_refs: _,
            } => {
                let slot_kind = SlotKind::new(&slot, w, scopes)?;
                let child_ident = w.declare_var_on_top_scope_init(|w, ident| {
                    Node::to_proc_gen_define_children(
                        &mut children.iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
                            w.function_args(args, |w| {
                                Node::to_proc_gen_define_children_content(
                                    &children,
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
            ElementKind::If {
                branches,
                else_branch,
            } => {
                enum CondItem<'a> {
                    None,
                    Static(&'a str),
                    Dynamic(ExpressionProcGen),
                }
                let mut cond_list =
                    Vec::with_capacity(branches.len() + if else_branch.is_some() { 1 } else { 0 });
                for (cond, _children) in branches
                    .iter()
                    .map(|(_, x, y)| (Some(x), y))
                    .chain(else_branch.as_ref().map(|(_, y)| (None, y)))
                {
                    let item = match cond {
                        None => CondItem::None,
                        Some(Value::Static { value, .. }) => CondItem::Static(value.as_str()),
                        Some(Value::Dynamic { expression, .. }) => {
                            let p = expression.to_proc_gen_prepare(w, scopes)?;
                            CondItem::Dynamic(p)
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
                    let mut list_iter: Box<dyn Iterator<Item = &Node>> = Box::new([].iter());
                    for children in branches
                        .iter()
                        .map(|(_, _, y)| y)
                        .chain(else_branch.as_ref().map(|(_, y)| y))
                    {
                        list_iter = Box::new(list_iter.chain(children.iter()));
                    }
                    let list: Vec<&Node> = list_iter.collect();
                    Node::to_proc_gen_define_children(
                        &mut list.into_iter(),
                        w,
                        scopes,
                        |args, w, var_slot_map, scopes| {
                            w.function_args(&args, |w| {
                                w.expr_stmt(|w| {
                                    for (index, (_, _, children)) in branches.iter().enumerate() {
                                        if index > 0 {
                                            write!(w, "else ")?;
                                        }
                                        write!(w, "if({}==={})", var_branch_index, index + 1)?;
                                        w.brace_block(|w| {
                                            Node::to_proc_gen_define_children_content(
                                                children,
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
                                    if let Some((_, children)) = else_branch.as_ref() {
                                        write!(w, "else")?;
                                        w.brace_block(|w| {
                                            Node::to_proc_gen_define_children_content(
                                                children,
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
            ElementKind::For {
                list,
                key,
                children,
                ..
            } => {
                enum ListExpr {
                    Static(String),
                    Dynamic(ExpressionProcGen),
                }
                let list_expr: ListExpr;
                match &list.1 {
                    Value::Static { value, .. } => {
                        list_expr = ListExpr::Static(value.to_string());
                    }
                    Value::Dynamic { expression, .. } => {
                        let p = expression.to_proc_gen_prepare(w, scopes)?;
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
                    Node::to_proc_gen_define_children(
                        &mut children.iter(),
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
                                Node::to_proc_gen_define_children_content(
                                    &children,
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
                                match key.1.name.as_str() {
                                    "" => "null".into(),
                                    key => gen_lit_str(key),
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
            ElementKind::TemplateRef { target, data } => {
                let var_key = w.declare_var_on_top_scope()?;
                match &target.1 {
                    Value::Static { value, .. } => {
                        w.expr_stmt(|w| {
                            write!(w, "{}={}", var_key, gen_lit_str(value.as_str()))?;
                            Ok(())
                        })?;
                    }
                    Value::Dynamic { expression, .. } => {
                        let p = expression.to_proc_gen_prepare(w, scopes)?;
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
                        match &data.1 {
                            Value::Static { value, .. } => w.expr_stmt(|w| {
                                write!(
                                    w,
                                    "if({}&&{}){}(R,C,{},undefined).C(C,T,E,B,F,S,J)",
                                    var_key,
                                    var_target,
                                    var_target,
                                    gen_lit_str(value)
                                )?;
                                Ok(())
                            }),
                            Value::Dynamic { expression, .. } => {
                                let p = expression.to_proc_gen_prepare(w, scopes)?;
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
            ElementKind::Include {
                path: (_, rel_path),
            } => {
                let var_key = w.gen_private_ident();
                let normalized_path = crate::path::resolve(cur_path, &rel_path.name);
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
            ElementKind::Slot {
                name,
                values,
                common,
            } => {
                let slot_kind = SlotKind::new(&common.slot, w, scopes)?;
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
                    if values.len() > 0 || !common.is_empty() {
                        write!(w, r#","#)?;
                        w.function_args("N", |w| {
                            common.to_proc_gen_without_slot(w, scopes, bmc)?;
                            for attr in values {
                                let name = attr.name.name.as_str();
                                match &attr.value {
                                    Value::Static { value, .. } => {
                                        w.expr_stmt(|w| {
                                            write!(
                                                w,
                                                r#"if(C)R.l(N,{},{})"#,
                                                gen_lit_str(name),
                                                gen_lit_str(value)
                                            )?;
                                            Ok(())
                                        })?;
                                    }
                                    Value::Dynamic { expression, .. } => {
                                        let p = expression.to_proc_gen_prepare(w, scopes)?;
                                        w.expr_stmt(|w| {
                                            write!(w, "if(C||K||")?;
                                            p.lvalue_state_expr(w, scopes)?;
                                            write!(w, ")R.l(N,{},", gen_lit_str(name))?;
                                            p.value_expr(w)?;
                                            write!(w, ")")?;
                                            Ok(())
                                        })?;
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

fn write_attribute_value<W: Write>(
    w: &mut JsFunctionScopeWriter<W>,
    method_name: &'static str,
    value: &Value,
    scopes: &Vec<ScopeVar>,
    bmc: &BindingMapCollector,
) -> Result<(), TmplError> {
    match &value {
        Value::Static { value, location: _ } => {
            w.expr_stmt(|w| {
                write!(w, "if(C){}(N,{})", method_name, gen_lit_str(value))?;
                Ok(())
            })?;
        }
        Value::Dynamic {
            expression,
            double_brace_location: _,
            binding_map_keys,
        } => {
            let p = expression.to_proc_gen_prepare(w, scopes)?;
            w.expr_stmt(|w| {
                write!(w, "if(C||K||")?;
                p.lvalue_state_expr(w, scopes)?;
                write!(w, "){}(N,", method_name)?;
                p.value_expr(w)?;
                write!(w, ")")?;
                Ok(())
            })?;
            if let Some(binding_map_keys) = binding_map_keys {
                if !binding_map_keys.is_empty(bmc) {
                    binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                        let p = expression.to_proc_gen_prepare(w, scopes)?;
                        w.expr_stmt(|w| {
                            write!(w, "{}(N,", method_name)?;
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
}

impl CommonElementAttributes {
    fn to_proc_gen_without_slot<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        let CommonElementAttributes {
            id,
            slot: _,
            slot_value_refs: _,
            event_bindings,
            marks,
        } = self;
        for mark in marks {
            mark.to_proc_gen_with_method(w, "M", scopes, bmc)?;
        }
        for ev in event_bindings {
            ev.to_proc_gen(w, scopes, bmc)?;
        }
        if let Some((_, value)) = id.as_ref() {
            write_attribute_value(w, "R.i", value, scopes, bmc)?;
        }
        Ok(())
    }
}

impl Attribute {
    fn to_proc_gen_with_method<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        method_name: &str,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        match &self.value {
            Value::Static { value, location: _ } => {
                w.expr_stmt(|w| {
                    write!(
                        w,
                        "if(C){}(N,{},{})",
                        method_name,
                        gen_lit_str(&self.name.name),
                        gen_lit_str(value)
                    )?;
                    Ok(())
                })?;
            }
            Value::Dynamic {
                expression,
                double_brace_location: _,
                binding_map_keys,
            } => {
                let p = expression.to_proc_gen_prepare(w, scopes)?;
                w.expr_stmt(|w| {
                    write!(w, "if(C||K||")?;
                    p.lvalue_state_expr(w, scopes)?;
                    write!(w, "){}(N,{},", method_name, gen_lit_str(&self.name.name))?;
                    p.value_expr(w)?;
                    write!(w, ")")?;
                    Ok(())
                })?;
                if let Some(binding_map_keys) = binding_map_keys {
                    if !binding_map_keys.is_empty(bmc) {
                        binding_map_keys.to_proc_gen_write_map(w, bmc, |w| {
                            let p = expression.to_proc_gen_prepare(w, scopes)?;
                            w.expr_stmt(|w| {
                                write!(w, "{}(N,{},", method_name, gen_lit_str(&self.name.name))?;
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
        Ok(())
    }

    fn to_proc_gen_as_normal<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        let attr_name = gen_lit_str(&self.name.name);
        match &self.value {
            Value::Static { value, location: _ } => {
                w.expr_stmt(|w| {
                    write!(w, "if(C)O(N,{},{})", attr_name, gen_lit_str(value))?;
                    Ok(())
                })?;
            }
            Value::Dynamic {
                expression,
                double_brace_location: _,
                binding_map_keys,
            } => {
                let maybe_event_binding = !self.is_model && {
                    attr_name.starts_with("bind")
                        || attr_name.starts_with("capture-bind")
                        || attr_name.starts_with("catch")
                        || attr_name.starts_with("capture-catch")
                        || attr_name.starts_with("on")
                };
                let p = expression.to_proc_gen_prepare(w, scopes)?;
                w.expr_stmt(|w| {
                    write!(w, "if(C||K||")?;
                    p.lvalue_state_expr(w, scopes)?;
                    write!(w, ")O(N,{},", attr_name)?;
                    p.value_expr(w)?;
                    if self.is_model {
                        if p.has_model_lvalue_path(scopes) {
                            write!(w, ",")?;
                            p.lvalue_path(w, scopes, Some(true))?;
                        }
                    } else if maybe_event_binding {
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
                            let p = expression.to_proc_gen_prepare(w, scopes)?;
                            w.expr_stmt(|w| {
                                write!(w, "O(N,{},", attr_name)?;
                                p.value_expr(w)?;
                                if self.is_model {
                                    if p.has_model_lvalue_path(scopes) {
                                        write!(w, ",")?;
                                        p.lvalue_path(w, scopes, Some(true))?;
                                    }
                                } else if maybe_event_binding {
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
        Ok(())
    }

    fn to_proc_gen_as_change_property<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        let attr_name = gen_lit_str(&self.name.name);
        match &self.value {
            Value::Static { .. } => {}
            Value::Dynamic {
                expression,
                double_brace_location: _,
                binding_map_keys,
            } => {
                let p = expression.to_proc_gen_prepare(w, scopes)?;
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
                            let p = expression.to_proc_gen_prepare(w, scopes)?;
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
        Ok(())
    }
}

impl EventBinding {
    fn to_proc_gen<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        match &self.value {
            Value::Static { value, location: _ } => {
                w.expr_stmt(|w| {
                    write!(
                        w,
                        "if(C)R.v(N,{},{},{},{},{},!1)",
                        gen_lit_str(&self.name.name),
                        gen_lit_str(value),
                        if self.is_catch { "!0" } else { "!1" },
                        if self.is_mut { "!0" } else { "!1" },
                        if self.is_capture { "!0" } else { "!1" },
                    )?;
                    Ok(())
                })?;
            }
            Value::Dynamic {
                expression,
                double_brace_location: _,
                binding_map_keys,
            } => {
                let p = expression.to_proc_gen_prepare(w, scopes)?;
                w.expr_stmt(|w| {
                    write!(w, "if(C||K||")?;
                    p.lvalue_state_expr(w, scopes)?;
                    write!(w, ")R.v(N,{},", gen_lit_str(&self.name.name),)?;
                    p.value_expr(w)?;
                    write!(
                        w,
                        ",{},{},{},!0",
                        if self.is_catch { "!0" } else { "!1" },
                        if self.is_mut { "!0" } else { "!1" },
                        if self.is_capture { "!0" } else { "!1" },
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
                            let p = expression.to_proc_gen_prepare(w, scopes)?;
                            w.expr_stmt(|w| {
                                write!(w, "R.v(N,{},", gen_lit_str(&self.name.name))?;
                                p.value_expr(w)?;
                                write!(
                                    w,
                                    ",{},{},{},!0)",
                                    if self.is_catch { "!0" } else { "!1" },
                                    if self.is_mut { "!0" } else { "!1" },
                                    if self.is_capture { "!0" } else { "!1" },
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
        }
        Ok(())
    }
}

impl StaticAttribute {
    fn to_proc_gen_as_worklet_property<W: std::fmt::Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        _scopes: &Vec<ScopeVar>,
        _bmc: &BindingMapCollector,
    ) -> Result<(), TmplError> {
        let attr_name = gen_lit_str(&self.name.name);
        w.expr_stmt(|w| {
            write!(
                w,
                "if(C)R.wl(N,{},{})",
                attr_name,
                gen_lit_str(&self.value.name)
            )?;
            Ok(())
        })?;
        Ok(())
    }
}

enum SlotKind<'a> {
    None,
    Static(&'a str),
    Dynamic(ExpressionProcGen),
}

impl<'a> SlotKind<'a> {
    fn new<W: Write>(
        slot: &'a Option<(Range<Position>, Value)>,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
    ) -> Result<Self, TmplError> {
        let this = match slot.as_ref().map(|x| &x.1) {
            None => SlotKind::None,
            Some(Value::Static { value, .. }) => SlotKind::Static(value.as_str()),
            Some(Value::Dynamic { expression, .. }) => {
                let p = expression.to_proc_gen_prepare(w, scopes)?;
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
    Dynamic(ExpressionProcGen),
}

impl<'a> StaticStrOrProcGen<'a> {
    fn new<W: Write>(
        v: &'a (Range<Position>, Value),
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &mut Vec<ScopeVar>,
    ) -> Result<Self, TmplError> {
        let this = match &v.1 {
            Value::Static { value: s, .. } => Self::Static(s.as_str()),
            Value::Dynamic { expression, .. } => {
                let p = expression.to_proc_gen_prepare(w, scopes)?;
                Self::Dynamic(p)
            }
        };
        Ok(this)
    }
}

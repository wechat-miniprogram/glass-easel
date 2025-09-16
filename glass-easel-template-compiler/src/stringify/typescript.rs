use std::fmt::{Result as FmtResult, Write as FmtWrite};

use sourcemap::SourceMap;

use crate::{escape::dash_to_camel, parse::{expr::*, tag::*, Position, Template, TemplateStructure}, stringify::{expr::{expression_strigify_write, ExpressionLevel}, Stringifier, StringifierBlock, StringifierLine, StringifierLineState, StringifyOptions}};

trait ConvertedExprWriteBlock {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult;
}

trait ConvertedExprWriteInline {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult;
}

pub(crate) const fn tmpl_converted_expr_runtime_string() -> &'static str {
    r#"
type _ForIndex_<T> = T extends Array<any> ? number : T extends Record<infer K, any> ? K : number;
type _ForItem_<T> = T extends Array<infer T> ? T : T extends Record<any, infer V> ? V : any;
type _ForKey_<T, N extends string> = N extends "*this" ? _ForItem_<T> : _ForItem_<T> extends Record<string, any> ? _ForItem_<T>[N] : unknown;
"#
}

pub(crate) fn generate_tmpl_converted_expr(tree: &Template, ts_env: &str, runtime: &str) -> (String, SourceMap) {
    let ret = String::new();
    let options = StringifyOptions {
        source_map: true,
        mangling: false,
        minimize: true,
        ..Default::default()
    };
    let mut w = Stringifier::new(ret, &tree.path, None, options);
    w.block(|w| {
        w.write_line(|w| w.write_str(ts_env))?;
        w.write_line(|w| w.write_str(runtime))?;
        for script in tree.globals.scripts.iter() {
            w.add_scope(&script.module_name().name);
        }

        // TODO tree.globals.imports
        // TODO tree.globals.includes

        for tmpl in tree.globals.sub_templates.iter() {
            tmpl.content.converted_expr_write(w)?;
        }
        tree.content.converted_expr_write(w)
    }).unwrap();

    let (s, sm) = w.finish();
    (s, sm.unwrap())
}

impl ConvertedExprWriteBlock for Vec<Node> {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
        for node in self {
            node.converted_expr_write(w)?;
        }
        Ok(())
    }
}

impl ConvertedExprWriteBlock for Node {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
        match self {
            Self::Text(x) => write_dynamic_value(x, w),
            Self::Element(x) => x.converted_expr_write(w),
            Self::Comment(_) | Self::UnknownMetaTag(_) => Ok(()),
        }
    }
}

fn wrap_brace_block<'s, 't, W: FmtWrite>(
    w: &mut StringifierBlock<'s, 't, W>,
    tag_location: &TagLocation,
    f: impl FnOnce(&mut StringifierBlock<'s, '_, W>) -> FmtResult,
) -> FmtResult {
    w.write_line(|w| {
        w.write_token("{", None, &tag_location.start.0)
    })?;
    w.write_sub_block(|w| {
        f(w)
    })?;
    w.write_line(|w| {
        w.write_token("}", None, tag_location.end.as_ref().map(|x| &x.0).unwrap_or(&tag_location.start.1))
    })
}

fn write_token_series<'s, 't, 'u, W: FmtWrite, const N: usize>(
    tokens: [&str; N],
    location: &std::ops::Range<Position>,
    w: &mut StringifierLine<'s, 't, 'u, W>,
) -> FmtResult {
    for token in tokens {
        w.write_token_state(token, Some(""), location, StringifierLineState::Normal)?;
    }
    Ok(())
}

fn write_let_vars<'s, 't, W: FmtWrite>(let_vars: &[Attribute], w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
    for attr in let_vars {
        let scope_name = w.add_scope(&attr.name.name);
        let var_name = format!("_scope_{}", scope_name);
        w.write_line(|w| {
            write_token_series(["const "], &(attr.name.location.start..attr.name.location.start), w)?;
            w.write_token_state(&var_name, Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
            let pos = attr.name.location.end;
            w.write_token_state("=", Some(""), &(pos..pos), StringifierLineState::Normal)?;
            if let Some(value) = &attr.value {
                value.converted_expr_write(w)?;
            } else {
                w.write_token_state("undefined", None, &(pos..pos), StringifierLineState::Normal)?;
            }
            w.write_token(";", None, &(pos..pos))
        })?;
    }
    Ok(())
}

fn write_dynamic_value<'s, 't, W: FmtWrite>(x: &Value, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
    if let Value::Static { .. } = x {
        Ok(())
    } else {
        w.write_line(|w| {
            x.converted_expr_write(w)?;
            let pos = x.location_end();
            w.write_token(";", None, &(pos..pos))
        })
    }
}

fn write_slot_value_refs<'s, 't, W: FmtWrite>(slot_value_refs: &[StaticAttribute], w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
    // IDEA impl slot value typing
    for attr in slot_value_refs {
        let scope_name = w.add_scope(&attr.name.name);
        let var_name = format!("_scope_{}", scope_name);
        w.write_line(|w| {
            write_token_series(["const "], &(attr.name.location.start..attr.name.location.start), w)?;
            w.write_token_state(&var_name, Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
            let pos = attr.name.location.end;
            write_token_series([":", "any", "=", "0", ";"], &(pos..pos), w)
        })?;
    }
    Ok(())
}

fn write_event_method<'s, 't, W: FmtWrite>(name: &Ident, value: &Option<Value>, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
    // IDEA impl event typing
    if let Some(value) = value.as_ref() {
        w.write_line(|w| {
            let pos = name.location.start;
            write_token_series(["var ", "_event_", ":", "Function", "="], &(pos..pos), w)?;
            if let Value::Static { value, location } = value {
                w.write_token_state("methods", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                w.write_token_state(".", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                w.write_token_state(&value, Some(&value), &location, StringifierLineState::Normal)?;
            } else {
                value.converted_expr_write(w)?;
            }
            w.write_token(";", None, &(pos..pos))
        })?;
    }
    Ok(())
}

fn write_common<'s, 't, W: FmtWrite>(common: &CommonElementAttributes, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
    let CommonElementAttributes { id, slot, slot_value_refs: _, event_bindings, data, marks } = common;
    if let Some(x) = id {
        write_dynamic_value(&x.1, w)?;
    }
    if let Some(x) = slot {
        write_dynamic_value(&x.1, w)?;
    }
    for item in data.iter().chain(marks.iter()) {
        if let Some(value) = item.value.as_ref() {
            write_dynamic_value(value, w)?;
        }
    }
    for ev in event_bindings.iter() {
        write_event_method(&ev.name, &ev.value, w)?;
    }
    Ok(())
}

impl ConvertedExprWriteBlock for Element {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
        match &self.kind {
            ElementKind::Normal {
                tag_name,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes,
                children,
                generics: _,
                extra_attr: _,
                let_vars,
                common,
            } => {
                wrap_brace_block(w, &self.tag_location, |w| {
                    w.write_line(|w| {
                        write_token_series(["const ", "_tag_", "=", "tags", "['"], &(tag_name.location.start..tag_name.location.start), w)?;
                        w.write_token_state(&tag_name.name, Some(&tag_name.name), &tag_name.location, StringifierLineState::Normal)?;
                        write_token_series(["']", ";"], &(tag_name.location.end..tag_name.location.end), w)
                    })?;
                    write_slot_value_refs(&common.slot_value_refs, w)?;
                    write_let_vars(let_vars, w)?;

                    // attributes
                    let nv_attr = attributes.iter().map(|x| (&x.name, &x.value));
                    let nv_change_attr = change_attributes.iter().map(|x| (&x.name, &x.value));
                    for (name, value) in nv_attr.chain(nv_change_attr) {
                        let attr_name = dash_to_camel(&name.name);
                        w.write_line(|w| {
                            match value {
                                None => {
                                    write_token_series(["_tag_", "."], &(name.location.start..name.location.start), w)?;
                                    w.write_token_state(&attr_name, Some(&name.name), &name.location, StringifierLineState::Normal)?;
                                    write_token_series(["=", "true", ";"], &(name.location.end..name.location.end), w)
                                }
                                Some(Value::Static { .. }) => {
                                    write_token_series(
                                        ["var ", "_string_or_number_", ":", "string", "|", "number", "=", "_tag_", "."],
                                        &(name.location.start..name.location.start),
                                        w,
                                    )?;
                                    w.write_token_state(&attr_name, Some(&name.name), &name.location, StringifierLineState::Normal)?;
                                    write_token_series([";"], &(name.location.end..name.location.end), w)
                                }
                                Some(value) => {
                                    write_token_series(["_tag_", "."], &(name.location.start..name.location.start), w)?;
                                    w.write_token_state(&attr_name, Some(&name.name), &name.location, StringifierLineState::Normal)?;
                                    let pos = name.location.end;
                                    w.write_token_state("=", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    value.converted_expr_write(w)?;
                                    write_token_series([";"], &(pos..pos), w)
                                }
                            }
                        })?;
                    }

                    // class
                    match class {
                        ClassAttribute::None => {}
                        ClassAttribute::String(loc, value) => {
                            w.write_line(|w| {
                                write_token_series(["var ", "_class_", ":", "string", "="], loc, w)?;
                                value.converted_expr_write(w)?;
                                let pos = loc.end;
                                write_token_series([";"], &(pos..pos), w)
                            })?;
                        }
                        ClassAttribute::Multiple(arr) => {
                            for (loc, _name, value) in arr {
                                if let Some(value) = value {
                                    w.write_line(|w| {
                                        write_token_series(["var ", "_class_enabled_", ":", "boolean", "="], loc, w)?;
                                        value.converted_expr_write(w)?;
                                        let pos = loc.end;
                                        write_token_series([";"], &(pos..pos), w)
                                    })?;
                                }
                            }
                        }
                    }

                    // style
                    match style {
                        StyleAttribute::None => {}
                        StyleAttribute::String(loc, value) => {
                            w.write_line(|w| {
                                write_token_series(["var ", "_style_", ":", "string", "="], loc, w)?;
                                value.converted_expr_write(w)?;
                                let pos = loc.end;
                                write_token_series([";"], &(pos..pos), w)
                            })?;
                        }
                        StyleAttribute::Multiple(arr) => {
                            for (loc, _name, value) in arr {
                                if let Value::Dynamic { .. } = value {
                                    w.write_line(|w| {
                                        write_token_series(["var ", "_style_property_", ":", "string", "="], loc, w)?;
                                        value.converted_expr_write(w)?;
                                        let pos = loc.end;
                                        write_token_series([";"], &(pos..pos), w)
                                    })?;
                                }
                            }
                        }
                    }

                    // worklet
                    for attr in worklet_attributes {
                        let v = Value::Static { value: attr.value.name.clone(), location: attr.value.location() };
                        write_event_method(&attr.name, &Some(v), w)?;
                    }

                    // children
                    write_common(common, w)?;
                    children.converted_expr_write(w)
                })?;
            }
            ElementKind::Pure {
                children,
                let_vars,
                slot,
                slot_value_refs,
            } => {
                wrap_brace_block(w, &self.tag_location, |w| {
                    write_slot_value_refs(slot_value_refs, w)?;
                    write_let_vars(let_vars, w)?;
                    if let Some(x) = slot {
                        write_dynamic_value(&x.1, w)?;
                    }
                    children.converted_expr_write(w)
                })?;
            }
            ElementKind::For {
                list,
                item_name,
                index_name,
                key,
                children,
            } => {
                wrap_brace_block(w, &self.tag_location, |w| {
                    let item_scope_name = w.add_scope(&item_name.1.name).clone();
                    let index_scope_name = w.add_scope(&index_name.1.name).clone();
                    w.write_line(|w| {
                        write_token_series(["const ", "_for_", "="], &list.0, w)?;
                        list.1.converted_expr_write(w)?;
                        write_token_series([";"], &list.0, w)
                    })?;
                    w.write_line(|w| {
                        write_token_series(["const "], &item_name.0, w)?;
                        w.write_token_state(&item_scope_name, Some(&item_name.1.name), &item_name.1.location, StringifierLineState::Normal)?;
                        write_token_series(
                            ["=", "0", " as ", "unknown", " as ", "_ForItem", "<", "typeof ", "_for_", ">", ";"],
                            &(item_name.0.end..item_name.0.end),
                            w,
                        )
                    })?;
                    w.write_line(|w| {
                        write_token_series(["const "], &index_name.0, w)?;
                        w.write_token_state(&index_scope_name, Some(&index_name.1.name), &index_name.1.location, StringifierLineState::Normal)?;
                        write_token_series(
                            ["=", "0", " as ", "unknown", " as ", "_ForIndex", "<", "typeof ", "_for_", ">", ";"],
                            &(item_name.0.end..item_name.0.end),
                            w,
                        )
                    })?;
                    w.write_line(|w| {
                        write_token_series(
                            ["var ", "_string_or_number_", ":", "string", "|", "number", "=", "0", " as ", "unknown", " as ", "_ForKey_", "<", "typeof ", "_for_", ","],
                            &(key.0.start..key.0.start),
                            w,
                        )?;
                        let name_str = crate::escape::gen_lit_str(&key.1.name);
                        w.write_token_state(&name_str, Some(&key.1.name), &key.1.location, StringifierLineState::Normal)?;
                        write_token_series([">", ";"], &(key.0.end..key.0.end), w)
                    })?;
                    children.converted_expr_write(w)
                })?;
            }
            ElementKind::If { branches, else_branch } => {
                for (_loc, cond, children) in branches {
                    write_dynamic_value(cond, w)?;
                    children.converted_expr_write(w)?;
                }
                if let Some((_loc, children)) = else_branch {
                    children.converted_expr_write(w)?;
                }
            }
            ElementKind::TemplateRef { target: _, data } => {
                // IDEA impl template typing
                write_dynamic_value(&data.1, w)?;
            }
            ElementKind::Include { path: _ } => {
                // IDEA impl include typing
            }
            ElementKind::Slot { name: _, values, common } => {
                wrap_brace_block(w, &self.tag_location, |w| {
                    write_slot_value_refs(&common.slot_value_refs, w)?;
                    for attr in values {
                        // IDEA impl slot value typing
                        if let Some(value) = attr.value.as_ref() {
                            write_dynamic_value(value, w)?;
                        }
                    }
                    write_common(common, w)
                })?;
            }
        }
        Ok(())
    }
}

impl ConvertedExprWriteInline for Value {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult {
        match self {
            Self::Static { value, location } => {
                w.write_token_state(&format!("{:?}", value), Some(value), location, StringifierLineState::Normal)
            }
            Self::Dynamic { expression, double_brace_location: _, binding_map_keys: _ } => {
                let mut prev_loc = None;
                expression.for_each_static_or_dynamic_part::<std::fmt::Error>(|part, loc| {
                    if let Some(prev_loc) = prev_loc.take() {
                        w.write_token_state("+", Some(""), &prev_loc, StringifierLineState::Normal)?;
                    }
                    if let Expression::ToStringWithoutUndefined { value, location } = part {
                        value.converted_expr_write(w)?;
                        prev_loc = Some(location.end..location.end);
                    } else {
                        part.converted_expr_write(w)?;
                        let pos = loc.end;
                        prev_loc = Some(pos..pos);
                    }
                    Ok(())
                })
            }
        }
    }
}

impl ConvertedExprWriteInline for Expression {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult {
        fn filter<'s, 't, 'u, W: FmtWrite>(expr: &Expression, w: &mut StringifierLine<'s, 't, 'u, W>, accept_level: ExpressionLevel) -> Result<bool, std::fmt::Error> {
            match expr {
                Expression::DataField { name, location } => {
                    if ExpressionLevel::Member > accept_level {
                        w.write_token_state("(", Some(""), location, StringifierLineState::ParenStart)?;
                    }
                    w.write_token_state("data", Some(""), location, StringifierLineState::Normal)?;
                    w.write_token_state(".", Some(""), location, StringifierLineState::NoSpaceAround)?;
                    w.write_token_state(
                        name,
                        Some(name),
                        location,
                        StringifierLineState::Normal,
                    )?;
                    if ExpressionLevel::Member > accept_level {
                        w.write_token_state(")", Some(""), location, StringifierLineState::ParenEnd)?;
                    }
                    Ok(false)
                }
                Expression::StaticMember { obj, field_name, dot_location, field_location } => {
                    if ExpressionLevel::Member > accept_level {
                        let pos = obj.location_start();
                        w.write_token_state("(", Some(""), &(pos..pos), StringifierLineState::ParenStart)?;
                    }
                    expression_strigify_write(obj, w, ExpressionLevel::Member, &filter)?;
                    w.write_token_state(
                        "?.",
                        None,
                        dot_location,
                        StringifierLineState::NoSpaceAround,
                    )?;
                    w.write_token_state(
                        &field_name,
                        Some(&field_name),
                        field_location,
                        StringifierLineState::Normal,
                    )?;
                    if ExpressionLevel::Member > accept_level {
                        let pos = field_location.end;
                        w.write_token_state(")", Some(""), &(pos..pos), StringifierLineState::ParenEnd)?;
                    }
                    Ok(false)
                }
                Expression::DynamicMember { obj, field_name, bracket_location } => {
                    if ExpressionLevel::Member > accept_level {
                        let pos = obj.location_start();
                        w.write_token_state("(", Some(""), &(pos..pos), StringifierLineState::ParenStart)?;
                    }
                    expression_strigify_write(obj, w, ExpressionLevel::Member, &filter)?;
                    w.write_token_state(
                        "?.[",
                        None,
                        &bracket_location.0,
                        StringifierLineState::ParenCall,
                    )?;
                    expression_strigify_write(&field_name, w, ExpressionLevel::Cond, &filter)?;
                    w.write_token_state(
                        "]",
                        None,
                        &bracket_location.1,
                        StringifierLineState::ParenEnd,
                    )?;
                    if ExpressionLevel::Member > accept_level {
                        let pos = bracket_location.1.end;
                        w.write_token_state(")", Some(""), &(pos..pos), StringifierLineState::ParenEnd)?;
                    }
                    Ok(false)
                }
                Expression::FuncCall { func, args, paren_location } => {
                    if ExpressionLevel::Member > accept_level {
                        let pos = func.location_start();
                        w.write_token_state("(", Some(""), &(pos..pos), StringifierLineState::ParenStart)?;
                    }
                    expression_strigify_write(func, w, ExpressionLevel::Member, &filter)?;
                    w.write_token_state(
                        "?.(",
                        None,
                        &paren_location.0,
                        StringifierLineState::ParenCall,
                    )?;
                    for (index, arg) in args.iter().enumerate() {
                        if index > 0 {
                            w.write_str_state(",", StringifierLineState::NoSpaceBefore)?;
                        }
                        expression_strigify_write(&arg, w, ExpressionLevel::Cond, &filter)?;
                    }
                    w.write_token_state(
                        ")",
                        None,
                        &paren_location.1,
                        StringifierLineState::ParenEnd,
                    )?;
                    if ExpressionLevel::Member > accept_level {
                        let pos = paren_location.1.end;
                        w.write_token_state(")", Some(""), &(pos..pos), StringifierLineState::ParenEnd)?;
                    }
                    Ok(false)
                }
                _ => Ok(true),
            }
        }
        expression_strigify_write(self, w, ExpressionLevel::Cond, &filter)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn convert(src: &str) -> (String, SourceMap) {
        let mut group = crate::TmplGroup::new();
        group.add_tmpl("TEST", src);
        generate_tmpl_converted_expr(group.get_tree("TEST").unwrap(), "", "")
    }

    fn find_token(sm: &SourceMap, line: u32, col: u32) -> Option<(u32, u32)> {
        let token = sm.lookup_token(line, col)?;
        Some(token.get_src())
    }

    #[test]
    fn basic() {
        let src = r#"<view>{{ hello }}</view>"#;
        let expect = r#"{const _tag_=tags['view'];data.hello;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 0), Some((0, 0)));
        assert_eq!(find_token(&sm, 0, 1), Some((0, 1)));
        assert_eq!(find_token(&sm, 0, 7), Some((0, 1)));
        assert_eq!(find_token(&sm, 0, 13), Some((0, 1)));
        assert_eq!(find_token(&sm, 0, 19), Some((0, 1)));
        assert_eq!(find_token(&sm, 0, 25), Some((0, 5)));
        assert_eq!(find_token(&sm, 0, 26), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 31), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 36), Some((0, 17)));
        assert_eq!(find_token(&sm, 0, 37), Some((0, 17)));
    }

    #[test]
    fn composed_text_node() {
        let src = r#"Hello {{ world }}!"#;
        let expect = r#""Hello "+data.world+"!";"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 0), Some((0, 0)));
        assert_eq!(find_token(&sm, 0, 8), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 9), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 14), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 19), Some((0, 17)));
        assert_eq!(find_token(&sm, 0, 23), Some((0, 18)));
    }

    #[test]
    fn normal_attr_no_value() {
        let src = r#"<custom-comp attr-a />"#;
        let expect = r#"{const _tag_=tags['custom-comp'];_tag_.attrA=true;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 33), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 39), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 45), Some((0, 19)));
        assert_eq!(find_token(&sm, 0, 49), Some((0, 19)));
    }

    #[test]
    fn normal_attr_static_value() {
        let src = r#"<custom-comp attr-a="x" />"#;
        let expect = r#"{const _tag_=tags['custom-comp'];var _string_or_number_:string|number=_tag_.attrA;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 34), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 37), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 56), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 70), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 76), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 81), Some((0, 19)));
    }

    #[test]
    fn normal_attr_dynamic_value() {
        let src = r#"<custom-comp attr-a="{{ x }}" />"#;
        let expect = r#"{const _tag_=tags['custom-comp'];_tag_.attrA=data.x;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 33), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 39), Some((0, 13)));
        assert_eq!(find_token(&sm, 0, 45), Some((0, 24)));
        assert_eq!(find_token(&sm, 0, 50), Some((0, 24)));
        assert_eq!(find_token(&sm, 0, 51), Some((0, 19)));
    }

    #[test]
    fn change_attr() {
        let src = r#"<custom-comp change:attr-a="{{ x }}" />"#;
        let expect = r#"{const _tag_=tags['custom-comp'];_tag_.attrA=data.x;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 33), Some((0, 20)));
        assert_eq!(find_token(&sm, 0, 39), Some((0, 20)));
        assert_eq!(find_token(&sm, 0, 45), Some((0, 31)));
        assert_eq!(find_token(&sm, 0, 50), Some((0, 31)));
        assert_eq!(find_token(&sm, 0, 51), Some((0, 26)));
    }

    #[test]
    fn expr_static_field() {
        let src = r#"{{ obj.a }}"#;
        let expect = r#"data.obj?.a;"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 5), Some((0, 3)));
        assert_eq!(find_token(&sm, 0, 8), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 10), Some((0, 7)));
    }

    #[test]
    fn expr_dynamic_field() {
        let src = r#"{{ obj[a] }}"#;
        let expect = r#"data.obj?.[data.a];"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 5), Some((0, 3)));
        assert_eq!(find_token(&sm, 0, 8), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 11), Some((0, 7)));
        assert_eq!(find_token(&sm, 0, 16), Some((0, 7)));
        assert_eq!(find_token(&sm, 0, 17), Some((0, 8)));
    }

    #[test]
    fn expr_func_call() {
        let src = r#"{{ obj(a) }}"#;
        let expect = r#"data.obj?.(data.a);"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 5), Some((0, 3)));
        assert_eq!(find_token(&sm, 0, 8), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 11), Some((0, 7)));
        assert_eq!(find_token(&sm, 0, 16), Some((0, 7)));
        assert_eq!(find_token(&sm, 0, 17), Some((0, 8)));
    }

    #[test]
    fn element_class_single() {
        let src = r#"<view class="a {{ b }}" />"#;
        let expect = r#"{const _tag_=tags['view'];var _class_:string="a "+data.b;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 26), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 30), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 38), Some((0, 6)));
    }

    #[test]
    fn element_class_multiple() {
        let src = r#"<view class:a="{{ b }}" class:c />"#;
        let expect = r#"{const _tag_=tags['view'];var _class_enabled_:boolean=data.b;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 26), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 30), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 46), Some((0, 6)));
    }

    #[test]
    fn element_style_single() {
        let src = r#"<view style="color: red" />"#;
        let expect = r#"{const _tag_=tags['view'];var _style_:string="color: red";}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 26), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 30), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 38), Some((0, 6)));
    }

    #[test]
    fn element_style_multiple() {
        let src = r#"<view style:color="{{ r }}" />"#;
        let expect = r#"{const _tag_=tags['view'];var _style_property_:string=data.r;}"#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 26), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 30), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 47), Some((0, 6)));
    }

    // TODO more tests
}

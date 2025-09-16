use std::fmt::{Result as FmtResult, Write as FmtWrite};

use sourcemap::SourceMap;

use crate::{escape::dash_to_camel, parse::{expr::*, tag::*, Template, TemplateStructure}, stringify::{expr::{expression_strigify_write, ExpressionLevel}, Stringifier, StringifierBlock, StringifierLine, StringifierLineState, StringifyLine, StringifyOptions}};

trait ConvertedExprWriteBlock {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult;
}

trait ConvertedExprWriteInline {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult;
}

pub(crate) fn generate_tmpl_converted_expr(tree: &Template, ts_env: &str) -> (String, SourceMap) {
    let ret = String::new();
    let options = StringifyOptions {
        source_map: true,
        mangling: false,
        minimize: true,
        ..Default::default()
    };
    let mut w = Stringifier::new(ret, &tree.path, None, options);
    w.block(|w| {
        w.write_line(|w| w.write_str(ts_env))
    }).unwrap();

    // TODO tree.globals.imports
    // TODO tree.globals.includes

    w.block(|w| {
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
            Self::Text(x) => {
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
                generics,
                extra_attr,
                let_vars,
                common,
            } => {
                wrap_brace_block(w, &self.tag_location, |w| {
                    w.write_line(|w| {
                        w.write_token_state("const ", Some(""), &(tag_name.location.start..tag_name.location.start), StringifierLineState::Normal)?;
                        w.write_token_state("_tag_", Some(""), &tag_name.location, StringifierLineState::Normal)?;
                        w.write_token_state("=", Some(""), &(tag_name.location.end..tag_name.location.end), StringifierLineState::Normal)?;
                        w.write_token_state("tags", Some(""), &tag_name.location, StringifierLineState::Normal)?;
                        w.write_token_state("['", Some(""), &tag_name.location, StringifierLineState::Normal)?;
                        w.write_token_state(&tag_name.name, Some(&tag_name.name), &tag_name.location, StringifierLineState::Normal)?;
                        w.write_token_state("']", Some(""), &tag_name.location, StringifierLineState::Normal)?;
                        w.write_token(";", None, &(tag_name.location.end..tag_name.location.end))
                    })?;
                    // TODO handling attrs
                    for attr in attributes {
                        let attr_name = dash_to_camel(&attr.name.name);
                        w.write_line(|w| {
                            match &attr.value {
                                None => {
                                    w.write_token_state("_tag_", Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    w.write_token_state(".", Some(&attr.name.name), &attr.name.location, StringifierLineState::NoSpaceAround)?;
                                    w.write_token_state(&attr_name, Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    let pos = attr.name.location.end;
                                    w.write_token_state("=", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("true", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token(";", None, &(pos..pos))
                                }
                                Some(Value::Static { .. }) => {
                                    let pos = attr.name.location.start;
                                    w.write_token_state("var ", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("_string_or_number_", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state(":", Some(""), &(pos..pos), StringifierLineState::NoSpaceBefore)?;
                                    w.write_token_state("string", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("|", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("number", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("=", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    w.write_token_state("_tag_", Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    w.write_token_state(".", Some(&attr.name.name), &attr.name.location, StringifierLineState::NoSpaceAround)?;
                                    w.write_token_state(&attr_name, Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    let pos = attr.name.location.end;
                                    w.write_token(";", None, &(pos..pos))
                                }
                                Some(value) => {
                                    w.write_token_state("_tag_", Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    w.write_token_state(".", Some(&attr.name.name), &attr.name.location, StringifierLineState::NoSpaceAround)?;
                                    w.write_token_state(&attr_name, Some(&attr.name.name), &attr.name.location, StringifierLineState::Normal)?;
                                    let pos = attr.name.location.end;
                                    w.write_token_state("=", Some(""), &(pos..pos), StringifierLineState::Normal)?;
                                    value.converted_expr_write(w)?;
                                    let pos = value.location_end();
                                    w.write_token(";", None, &(pos..pos))
                                }
                            }
                        })?;
                    }
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
                    // TODO handling attrs
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
                    // TODO handling attrs
                    children.converted_expr_write(w)
                })?;
            }
            ElementKind::If { branches, else_branch } => {
                for (loc, cond, children) in branches {
                    // TODO handling attrs
                    children.converted_expr_write(w)?;
                }
                if let Some((loc, children)) = else_branch {
                    children.converted_expr_write(w)?;
                }
            }
            ElementKind::TemplateRef { target, data } => {
                // TODO
            }
            ElementKind::Include { path } => {
                // TODO
            }
            ElementKind::Slot { name: _, values, common } => {
                // TODO
            }
        }
        Ok(())
    }
}

impl ConvertedExprWriteInline for Value {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult {
        match self {
            Self::Static { value: _, location: _ } => Ok(()),
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
        expression_strigify_write(self, w, ExpressionLevel::Cond, &|expr, w, accept_level| {
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
                _ => Ok(true),
            }
        })
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn convert(src: &str) -> (String, SourceMap) {
        let mut group = crate::TmplGroup::new();
        group.add_tmpl("TEST", src);
        generate_tmpl_converted_expr(group.get_tree("TEST").unwrap(), "")
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
        assert_eq!(find_token(&sm, 0, 51), Some((0, 28)));
    }
}

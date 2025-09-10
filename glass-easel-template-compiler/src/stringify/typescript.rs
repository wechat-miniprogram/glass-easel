use std::fmt::{Result as FmtResult, Write as FmtWrite};

use sourcemap::SourceMap;

use crate::{parse::{expr::*, tag::*, Template, TemplateStructure}, stringify::{Stringifier, StringifierBlock, StringifierLine, StringifierLineState, StringifyLine, StringifyOptions}};

trait ConvertedExprWriteBlock {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult;
}

trait ConvertedExprWriteInline {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult;
}

pub(crate) fn generate_tmpl_converted_expr(tree: &Template) -> (String, SourceMap) {
    let ret = String::new();
    let options = StringifyOptions {
        source_map: true,
        mangling: false,
        minimize: true,
        ..Default::default()
    };
    let mut w = Stringifier::new(ret, &tree.path, None, options);

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
                w.write_line(|w| {
                    x.converted_expr_write(w)
                })
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
                    // TODO handling attrs
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
                        w.write_token_state("+", None, &prev_loc, StringifierLineState::Normal)?;
                    }
                    if let Expression::ToStringWithoutUndefined { value, location } = part {
                        value.stringify_write(w)?;
                        prev_loc = Some(location.end..location.end);
                    } else {
                        part.stringify_write(w)?;
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
        StringifyLine::stringify_write(self, w)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn convert(src: &str) -> (String, SourceMap) {
        let mut group = crate::TmplGroup::new();
        group.add_tmpl("TEST", src);
        generate_tmpl_converted_expr(group.get_tree("TEST").unwrap())
    }

    fn find_token(sm: &SourceMap, line: u32, col: u32) -> Option<(u32, u32)> {
        let token = sm.lookup_token(line, col)?;
        Some(token.get_src())
    }

    #[test]
    fn basic() {
        let src = r#"<view>{{ hello }}</view>"#;
        let expect = r#"{hello}"#;
        let (out, sm) = convert(src);
        dbg!(&sm);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 0), Some((0, 0)));
        assert_eq!(find_token(&sm, 0, 1), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 6), Some((0, 17)));
    }

    #[test]
    fn composed_text_node() {
        let src = r#"Hello {{ world }}!"#;
        let expect = r#""Hello "+world+"!""#;
        let (out, sm) = convert(src);
        assert_eq!(out, expect);
        assert_eq!(find_token(&sm, 0, 0), Some((0, 0)));
        assert_eq!(find_token(&sm, 0, 8), Some((0, 6)));
        assert_eq!(find_token(&sm, 0, 9), Some((0, 9)));
        assert_eq!(find_token(&sm, 0, 14), Some((0, 17)));
        assert_eq!(find_token(&sm, 0, 17), Some((0, 17)));
    }
}

use std::fmt::{Result as FmtResult, Write as FmtWrite};

use crate::{parse::{expr::*, tag::*, Template}, stringify::{Stringifier, StringifierBlock, StringifierLine, StringifyLine}};

trait ConvertedExprWriteBlock {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult;
}

trait ConvertedExprWriteInline {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult;
}

pub(crate) fn generate_tmpl_converted_expr(tree: &Template) -> String {
    let ret = String::new();
    let mut w = Stringifier::new(ret, &tree.path, None, Default::default());

    // TODO tree.globals.imports
    // TODO tree.globals.includes

    w.block(|w| {
        for tmpl in tree.globals.sub_templates.iter() {
            tmpl.content.converted_expr_write(w)?;
        }
        tree.content.converted_expr_write(w)
    }).unwrap();

    let (s, sm) = w.finish();
    s
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

impl ConvertedExprWriteBlock for Element {
    fn converted_expr_write<'s, 't, W: FmtWrite>(&self, w: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
        // TODO
        Ok(())
    }
}

impl ConvertedExprWriteInline for Value {
    fn converted_expr_write<'s, 't, 'u, W: FmtWrite>(&self, w: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult {
        match self {
            Self::Static { value: _, location: _ } => Ok(()),
            Self::Dynamic { expression, double_brace_location: _, binding_map_keys: _ } => {
                expression.converted_expr_write(w)
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

    fn convert(src: &str) -> String {
        let mut group = crate::TmplGroup::new();
        group.add_tmpl("TEST", src);
        generate_tmpl_converted_expr(group.get_tree("TEST").unwrap())
    }

    #[test]
    fn test() {
        let src = r#"{{ hello }}"#;
        let expect = "hello\n";
        assert_eq!(convert(src), expect);
    }
}

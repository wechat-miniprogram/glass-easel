use crate::parse::{tag::*, Template};

struct ConvertedExprWriter<'w> {
    target: &'w mut String,
    scope_level: usize,
}

impl<'w> ConvertedExprWriter<'w> {
    fn line(&mut self, ) {
        for _ in 0..self.scope_level {
            self.target.push_str("    ");
        }
        self.target.push_str(s);
        self.target.push('\n');
    }

    fn sub<'s>(&'s mut self) -> ConvertedExprWriter<'s> {
        ConvertedExprWriter { target: self.target, scope_level: self.scope_level + 1 }
    }
}

trait ConvertedExprWrite {
    fn converted_expr_write(&self, w: &mut ConvertedExprWriter<'_>);
}

pub(crate) fn generate_tmpl_converted_expr(tree: &Template) -> String {
    let mut ret = String::new();
    let mut w = ConvertedExprWriter {
        target: &mut ret,
        scope_level: 0,
    };

    // TODO tree.globals.imports
    // TODO tree.globals.includes

    for tmpl in tree.globals.sub_templates.iter() {
        tmpl.content.converted_expr_write(&mut w);
    }
    tree.content.converted_expr_write(&mut w);

    ret
}

impl ConvertedExprWrite for Vec<Node> {
    fn converted_expr_write(&self, w: &mut ConvertedExprWriter<'_>) {
        for node in self {
            // TODO
        }
    }
}

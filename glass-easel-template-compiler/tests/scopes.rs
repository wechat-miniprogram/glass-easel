//! Scope resolution order between WXS module scopes and local scopes.
//!
//! A `<wxs module="..." />` name is file-global and shadows same-named local scopes
//! (`wx:for-item`, `wx:for-index`, `slot:`, `let:`), the same as the official
//! miniprogram template compiler does. Local scopes still shadow each other from the
//! nearest ancestor. See issue #204.

use glass_easel_template_compiler::{
    parse::{
        expr::Expression,
        tag::{Element, ElementKind, Node, Template, Value},
    },
    TmplGroup,
};

fn walk<'a>(nodes: &'a [Node], out: &mut Vec<&'a Element>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        out.push(element);
        match &element.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => walk(children, out),
            ElementKind::If {
                branches,
                else_branch,
                ..
            } => {
                for (_, _, children) in branches {
                    walk(children, out);
                }
                if let Some((_, children)) = else_branch {
                    walk(children, out);
                }
            }
            ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => {}
            _ => {}
        }
    }
}

/// The scope index referred by the expression of the element attribute `attr_name`.
fn resolved_scope_index(tmpl: &Template, attr_name: &str) -> usize {
    let mut elements = vec![];
    walk(&tmpl.content, &mut elements);
    for element in elements {
        let ElementKind::Normal { attributes, .. } = &element.kind else {
            continue;
        };
        for attr in attributes {
            if attr.name.name.as_str() != attr_name {
                continue;
            }
            let Some(Value::Dynamic { expression, .. }) = &attr.value else {
                panic!("attribute {} is not dynamic", attr_name);
            };
            match expression.as_ref() {
                Expression::ScopeRef { index, .. } => return *index,
                other => panic!(
                    "attribute {} is not a scope reference: {:?}",
                    attr_name, other
                ),
            }
        }
    }
    panic!("attribute {} not found", attr_name);
}

#[test]
fn wxs_module_scope_wins_over_local_scope() {
    // scope list: [0] <wxs module="item">, [1] wx:for-item, [2] wx:for-index
    const SRC: &str = r#"<wxs module="item">exports.v = 1</wxs><view wx:for="{{list}}" hidden="{{item}}" idxref="{{index}}" />"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a", SRC);
    let tmpl = group.get_tree("a").unwrap();
    // the WXS module scope shadows the same-named wx:for-item scope
    assert_eq!(resolved_scope_index(tmpl, "hidden"), 0);
    // the other local scopes are untouched
    assert_eq!(resolved_scope_index(tmpl, "idxref"), 2);
}

#[test]
fn inner_local_scope_still_wins_over_outer_local_scope() {
    // scope list: [0] outer item, [1] outer index, [2] inner item, [3] inner index
    const SRC: &str = r#"<view wx:for="{{a}}" wx:for-item="item"><view wx:for="{{b}}" wx:for-item="item" hidden="{{item}}" idxref="{{index}}" /></view>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a", SRC);
    let tmpl = group.get_tree("a").unwrap();
    assert_eq!(resolved_scope_index(tmpl, "hidden"), 2);
    assert_eq!(resolved_scope_index(tmpl, "idxref"), 3);
}

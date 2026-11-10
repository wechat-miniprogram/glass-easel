//! Regression tests for duplicated attributes in a template.
//!
//! The official miniprogram template compiler keeps the **last** occurrence of a
//! duplicated attribute, i.e. `<view attr="a" attr="b" attr="c" />` behaves like
//! `<view attr="c" />`. See issue #217.

use glass_easel_template_compiler::{
    parse::tag::{Element, ElementKind, Node, NormalAttribute, Template, Value},
    stringify::{Stringify, Stringifier, StringifyOptions},
    TmplGroup,
};

fn root_element(tmpl: &Template) -> &Element {
    tmpl.content
        .iter()
        .find_map(|node| match node {
            Node::Element(element) => Some(element),
            _ => None,
        })
        .expect("no element parsed")
}

fn normal_attributes(element: &Element) -> &Vec<NormalAttribute> {
    match &element.kind {
        ElementKind::Normal { attributes, .. } => attributes,
        _ => panic!("expected a normal element"),
    }
}

fn stringify(tmpl: &Template, src: &str) -> String {
    let options = StringifyOptions {
        minimize: true,
        ..Default::default()
    };
    let mut stringifier = Stringifier::new(String::new(), "test", Some(src), options);
    tmpl.stringify_write(&mut stringifier).unwrap();
    stringifier.finish().0
}

#[test]
fn duplicated_attribute_keeps_last_value() {
    const SRC: &str = r#"<view attr="a" attr="b" attr="c" />"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a", SRC);
    let tmpl = group.get_tree("a").unwrap();
    let attr = &normal_attributes(root_element(tmpl))[0];
    assert_eq!(attr.name.name.as_str(), "attr");
    let Some(Value::Static { value, .. }) = &attr.value else {
        panic!("expect a static attribute value");
    };
    assert_eq!(value.as_str(), "c");
}

#[test]
fn duplicated_attribute_keeps_last_value_in_stringify() {
    const SRC: &str = r#"<view attr="a" attr="b" attr="c" />"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a", SRC);
    let tmpl = group.get_tree("a").unwrap();
    assert_eq!(normal_attributes(root_element(tmpl)).len(), 1);
    assert_eq!(stringify(tmpl, SRC), r#"<view attr="c"/>"#);
}

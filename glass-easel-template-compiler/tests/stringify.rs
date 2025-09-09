use glass_easel_template_compiler::{stringify::Stringifier, TmplGroup};

#[test]
fn stringifier() {
    const SRC_A: &str = r#"<!META><div><span> Hello world! </span></div>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a", SRC_A);
    let tmpl = group.get_tree("a").unwrap();
    let mut out = String::new();
    Stringifier::new(&mut out, "a", Some(SRC_A), Default::default())
        .run(tmpl)
        .unwrap();
    assert_eq!(
        out,
        "<!META>\n<div>\n    <span> Hello world! </span>\n</div>\n"
    );
}

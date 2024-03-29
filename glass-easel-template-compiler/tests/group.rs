use glass_easel_template_compiler::*;

#[test]
fn basic_include() {
    const SRC_A: &str = r#"<b a="{{a}}" /> <template name="a" />"#;
    const SRC_B: &str = r#"<c a="{{a}}"> <include src="b/.././a" /> </c>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a".into(), SRC_A);
    group.add_tmpl("b".into(), SRC_B);
    assert_eq!(
        group.direct_dependencies("a").unwrap().collect::<Vec<_>>(),
        Vec::<String>::new()
    );
    assert_eq!(
        group.direct_dependencies("b").unwrap().collect::<Vec<_>>(),
        vec!["a".to_string()]
    );
}

#[test]
fn basic_import() {
    const SRC_A: &str =
        r#"<b a="{{a}}" /> <template name="aa"><d a1="{{bb}}" a2="{{a}}" /></template>"#;
    const SRC_B: &str = r#"<c a="{{a}}"> <import src="/a" /> <template is="aa" data="{{ bb: a + 1, cc: false }}" /> </c>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a".into(), SRC_A);
    group.add_tmpl("b".into(), SRC_B);
    assert_eq!(
        group.direct_dependencies("a").unwrap().collect::<Vec<_>>(),
        Vec::<String>::new()
    );
    assert_eq!(
        group.direct_dependencies("b").unwrap().collect::<Vec<_>>(),
        vec!["a".to_string()]
    );
}

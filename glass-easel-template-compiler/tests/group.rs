use glass_easel_template_compiler::*;

#[test]
fn basic_include() {
    const SRC_A: &str = r#"<b a="{{a}}" /> <template name="a" />"#;
    const SRC_B: &str = r#"<c a="{{a}}"> <include src="b/.././a" /> </c>"#;
    const GEN_A: &str = r#"<template name="a"></template><b a="{{a}}"></b>"#;
    const GEN_B: &str = r#"<c a="{{a}}"><include src="b/.././a"></include></c>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a".into(), SRC_A).unwrap();
    group.add_tmpl("b".into(), SRC_B).unwrap();
    assert_eq!(
        group.get_direct_dependencies("a").unwrap(),
        Vec::<String>::new()
    );
    assert_eq!(
        group.get_direct_dependencies("b").unwrap(),
        vec!["a".to_string()]
    );
    assert_eq!(group.get_tree("a").unwrap().to_string(), GEN_A);
    assert_eq!(group.get_tree("b").unwrap().to_string(), GEN_B);
}

#[test]
fn basic_import() {
    const SRC_A: &str =
        r#"<b a="{{a}}" /> <template name="aa"><d a1="{{bb}}" a2="{{a}}" /></template>"#;
    const SRC_B: &str = r#"<c a="{{a}}"> <import src="/a" /> <template is="aa" data="{{ bb: a + 1, cc: false }}" /> </c>"#;
    const GEN_A: &str =
        r#"<template name="aa"><d a1="{{bb}}" a2="{{a}}"></d></template><b a="{{a}}"></b>"#;
    const GEN_B: &str = r#"<import src="/a"></import><c a="{{a}}"><template is="aa" data="{{{bb:a+1,cc:false}}}"></template></c>"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("a".into(), SRC_A).unwrap();
    group.add_tmpl("b".into(), SRC_B).unwrap();
    assert_eq!(
        group.get_direct_dependencies("a").unwrap(),
        Vec::<String>::new()
    );
    assert_eq!(
        group.get_direct_dependencies("b").unwrap(),
        vec!["a".to_string()]
    );
    assert_eq!(group.get_tree("a").unwrap().to_string(), GEN_A);
    assert_eq!(group.get_tree("b").unwrap().to_string(), GEN_B);
}

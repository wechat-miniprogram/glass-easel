use glass_easel_template_compiler::*;

#[test]
fn external_script() {
    const SRC_A: &str = r#"<wxs module="modA" src="/script/a" /> <wxs module="modB" src="../script/b" /> {{ modA.a + modB.b }}"#;
    const SRC_SCRIPT: &str = r#"(function(){return 0})()"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("tmpl/a".into(), SRC_A).unwrap();
    group.add_script("script/a".into(), SRC_SCRIPT).unwrap();
    group.add_script("script/b".into(), SRC_SCRIPT).unwrap();
    assert_eq!(group.get_script_dependencies("tmpl/a").unwrap(), vec!["script/a".to_string(), "script/b".to_string()]);
    assert_eq!(group.get_tmpl_gen_object_groups().unwrap(), "");
}

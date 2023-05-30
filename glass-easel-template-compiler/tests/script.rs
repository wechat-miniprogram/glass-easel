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
}

#[test]
fn inline_script() {
    const SRC_A: &str = r#"<div>{{ modA.hi }}</div> <wxs module="modA"> exports.hi = 1 < 2 </wxs> <wxs module="modB" />"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("tmpl/a".into(), SRC_A).unwrap();
    assert_eq!(group.get_script_dependencies("tmpl/a").unwrap().len(), 0);
    assert_eq!(group.get_inline_script_module_names("tmpl/a").unwrap(), vec!["modA".to_string(), "modB".to_string()]);
    assert_eq!(group.get_inline_script("tmpl/a", "modA").unwrap(), " exports.hi = 1 < 2 ");
    assert_eq!(group.get_inline_script("tmpl/a", "modB").unwrap(), "");
}

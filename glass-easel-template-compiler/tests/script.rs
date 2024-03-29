use glass_easel_template_compiler::*;

#[test]
fn external_script() {
    const SRC_A: &str = r#"<wxs module="modA" src="/script/a" /> <wxs module="modB" src="../script/b" /> {{ modA.a + modB.b }}"#;
    const SRC_SCRIPT: &str = r#"(function(){return 0})()"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("tmpl/a".into(), SRC_A);
    group.add_script("script/a".into(), SRC_SCRIPT);
    group.add_script("script/b".into(), SRC_SCRIPT);
    assert_eq!(
        group.script_dependencies("tmpl/a").unwrap().collect::<Vec<_>>(),
        vec!["script/a".to_string(), "script/b".to_string()],
    );
}

#[test]
fn inline_script() {
    const SRC_A: &str = r#"<div>{{ modA.hi }}</div> <wxs module="modA"> exports.hi = 1 < 2 </wxs> <wxs module="modB" />"#;
    let mut group = TmplGroup::new();
    group.add_tmpl("tmpl/a".into(), SRC_A);
    assert_eq!(group.script_dependencies("tmpl/a").unwrap().count(), 0);
    assert_eq!(
        group.inline_script_module_names("tmpl/a").unwrap().collect::<Vec<_>>(),
        vec!["modA".to_string(), "modB".to_string()],
    );
    assert_eq!(group.inline_script_content("tmpl/a", "modA").unwrap(), " exports.hi = 1 < 2 ");
    assert_eq!(group.inline_script_content("tmpl/a", "modB").unwrap(), "");
}

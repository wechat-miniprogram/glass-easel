//! Warnings for the attributes that expect a data binding.
//!
//! `class:` and `model:` attributes ignore a static value, and a boolean attribute with a static
//! value is a non-empty string (thus always truthy), so both cases silently do the wrong thing.
//! See issue #243.

use glass_easel_template_compiler::{
    parse::{ParseErrorKind, ParseErrorLevel},
    stringify::{Stringify, StringifyOptions, Stringifier},
    TmplGroup,
};

fn warnings(src: &str) -> Vec<ParseErrorKind> {
    let mut group = TmplGroup::new();
    group.add_tmpl("a", src).into_iter().map(|x| x.kind).collect()
}

fn stringify(src: &str) -> String {
    let mut group = TmplGroup::new();
    group.add_tmpl("a", src);
    let tmpl = group.get_tree("a").unwrap();
    let options = StringifyOptions {
        minimize: true,
        ..Default::default()
    };
    let mut stringifier = Stringifier::new(String::new(), "test", Some(src), options);
    tmpl.stringify_write(&mut stringifier).unwrap();
    stringifier.finish().0
}

#[test]
fn boolean_attribute_with_static_value_warns() {
    assert_eq!(
        warnings(r#"<view hidden="true" />"#),
        vec![ParseErrorKind::BooleanAttributeWithStaticValue]
    );
    // a static value is a non-empty string, so `hidden="false"` hides the element as well
    assert_eq!(
        warnings(r#"<view hidden="false" />"#),
        vec![ParseErrorKind::BooleanAttributeWithStaticValue]
    );
    assert_eq!(
        warnings(r#"<checkbox checked="true" />"#),
        vec![ParseErrorKind::BooleanAttributeWithStaticValue]
    );
    assert_eq!(
        warnings(r#"<button disabled="false" />"#),
        vec![ParseErrorKind::BooleanAttributeWithStaticValue]
    );
}

#[test]
fn class_colon_and_model_attribute_with_static_value_warn() {
    assert_eq!(
        warnings(r#"<view class:red="true" />"#),
        vec![ParseErrorKind::ExpectsDataBinding]
    );
    // the static value of `model:` is not a bindable path
    assert_eq!(
        warnings(r#"<view model:value="text" />"#),
        vec![ParseErrorKind::ExpectsDataBinding]
    );
    assert_eq!(
        warnings(r#"<view class:red="false" model:value="text" />"#),
        vec![
            ParseErrorKind::ExpectsDataBinding,
            ParseErrorKind::ExpectsDataBinding
        ]
    );
    assert!(ParseErrorKind::ExpectsDataBinding.level() == ParseErrorLevel::Warn);
    assert!(ParseErrorKind::BooleanAttributeWithStaticValue.level() == ParseErrorLevel::Warn);
}

#[test]
fn data_bindings_do_not_warn() {
    assert_eq!(
        warnings(r#"<view hidden="{{ flag }}" checked="{{ c }}" disabled="{{ d }}" />"#),
        vec![]
    );
    assert_eq!(warnings(r#"<view class:red="{{ flag }}" />"#), vec![]);
    assert_eq!(warnings(r#"<view model:value="{{ text }}" />"#), vec![]);
    assert_eq!(
        warnings(r#"<view hidden="{{ flag }}" class:red="{{ c }}" model:value="{{ text }}" />"#),
        vec![]
    );
}

#[test]
fn legitimate_static_values_do_not_warn() {
    // a boolean attribute without value is compiled into `true`
    assert_eq!(warnings(r#"<view hidden />"#), vec![]);
    // an empty value is falsy, so it is not a mistake
    assert_eq!(warnings(r#"<view hidden="" />"#), vec![]);
    // `class:` without value applies the class unconditionally
    assert_eq!(warnings(r#"<view class:red />"#), vec![]);
    // `class:` without value and empty value of `model:`
    assert_eq!(warnings(r#"<view class:red model:value="" />"#), vec![]);
    // plain attributes, class strings, data attributes and marks take static values
    assert_eq!(
        warnings(r#"<view class="a b" style="color:red" data-flag="false" mark:key="true" />"#),
        vec![]
    );
    // attributes out of the boolean list take static values
    assert_eq!(
        warnings(r#"<view mode="false" type="true" name="hidden" />"#),
        vec![]
    );
}

#[test]
fn warnings_do_not_change_the_compiled_output() {
    // a diagnostic only: the parsed tree is not rewritten
    assert_eq!(
        stringify(r#"<view hidden="true" class:red="true" model:value="text" />"#),
        // the stringifier emits `class:` attributes before plain attributes
        r#"<view class:red="true" hidden="true" model:value="text"/>"#
    );
    assert_eq!(
        stringify(r#"<view hidden="false">text</view>"#),
        r#"<view hidden="false">text</view>"#
    );
}

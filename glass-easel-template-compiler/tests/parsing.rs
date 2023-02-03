use glass_easel_template_compiler::*;

#[test]
fn basic_parsing() {
    let tree = parse_tmpl(
        r#" <!-- comment --> <div attr1='value 1' attr2=value&nbsp;2 > &lt;abc&gt; </div> def "#,
    )
    .unwrap();
    assert_eq!(
        tree.to_string(),
        r#"<div attr1="value 1" attr2="value 2"> &lt;abc&gt; </div> def "#
    );
}

#[test]
fn basic_expr_parsing() {
    let tree =
        parse_tmpl(r#"<div attr=" {{ (a + 1).b }} "> {{ c - ( d + e ) * 3 }} </div>"#).unwrap();
    assert_eq!(
        tree.to_string(),
        r#"<div attr="{{" "+Y(X(a+1).b)+" "}}">{{" "+Y(c-(d+e)*3)+" "}}</div>"#
    );
}

#[test]
fn basic_block_parsing() {
    let tree = parse_tmpl(r#"<div wx:if="{{v}}" wx:for="{{list}}" wx:for-item="v" wx:for-index="i" wx:key="k">{{i}}</div>"#).unwrap();
    assert_eq!(
        tree.to_string(),
        r#"<block wx:for="{{list}}" wx:for-item="$0" wx:for-index="$1" wx:key="k"><block wx:if="{{$0}}"><div>{{$1}}</div></block></block>"#
    );
}

#[test]
fn basic_sub_template_parsing() {
    let tree =
        parse_tmpl(r#"<div><template is="sub" /></div> <template name="sub"><view wx:for="{{a}}">{{item}}</view></template>"#)
            .unwrap();
    assert_eq!(
        tree.to_string(),
        r#"<template name="sub"><block wx:for="{{a}}" wx:for-item="$0" wx:for-index="$1"><view>{{$0}}</view></block></template><div><template is="sub" data=""></template></div>"#
    );
}

#[test]
fn generic() {
    let tree = parse_tmpl(r#"<element wx:if="{{true}}" generic:g="g"></element>"#).unwrap();
    assert_eq!(
        tree.to_string(),
        r#"<block wx:if="{{true}}"><element generic:g=g></element></block>"#
    )
}

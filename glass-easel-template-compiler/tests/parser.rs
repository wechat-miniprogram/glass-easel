use glass_easel_template_compiler::*;

#[test]
fn value_parsing() {
    case!("{ {", r#"{ {"#);
    case!("{{ a } }", "", ParseErrorKind::MissingExpressionEnd, 8..8);
    case!("{{ a b }}", "", ParseErrorKind::IllegalExpression, 5..7);
    case!(" a\t{{ b }}", r#"{{"a\t"+b}}"#);
    case!("{{ b }} a ", r#"{{b+' a '}}"#);
    case!("{{ a }}{{ b }}", r#"{{a+b}}"#);

    case!("{{ '", "", ParseErrorKind::MissingExpressionEnd, 4..4);
    case!(r#"{{ 'a\n\u0041\x4f\x4E' }}"#, "{{\"a\nAON\"}}");

    case!("&#xG;", r#"&#xG;"#, ParseErrorKind::IllegalEntity, 0..4);
    case!("&#x ", r#"&#x "#, ParseErrorKind::IllegalEntity, 0..3);
    case!("&#x41;", r#"A"#);
    case!("&#A;", r#"&#a;"#, ParseErrorKind::IllegalEntity, 0..3);
    case!("&# ", r#"&# "#, ParseErrorKind::IllegalEntity, 0..2);
    case!("&#97;", r#"a"#);
    case!("&lt", r#"&lt"#);
    case!("&lt ", r#"&lt "#);
    case!("&lt;", r#"<"#);
}

#[test]
fn tag_parsing() {
    case!("<", r#"<"#);
    case!("<-", r#"<-"#);
    case!("<div", r#"<div></div>"#, ParseErrorKind::IncompleteTag, 4..4);
    case!("<div ", r#"<div></div>"#, ParseErrorKind::IncompleteTag, 5..5);
    case!("<div>", r#"<div></div>"#, ParseErrorKind::MissingEndTag, 5..5);
    case!("<div >", r#"<div></div>"#, ParseErrorKind::MissingEndTag, 6..6);
    case!("<a:div/>", r#"<wx-x></wx-x>"#, ParseErrorKind::IllegalNamePrefix, 1..2);
    case!("<div/ ></div>", r#"<div></div>"#, ParseErrorKind::IllegalCharacter, 4..5);
    case!("<div a:mark:c/>", r#"<div></div>"#, ParseErrorKind::IllegalNamePrefix, 5..6);
    case!("<div marks:c/>", r#"<div></div>"#, ParseErrorKind::IllegalNamePrefix, 5..10);
    case!("<div a =''/>", r#"<div a=""></div>"#, ParseErrorKind::UnexpectedWhitespace, 6..7);
    case!("<div a= ''/>", r#"<div a=""></div>"#, ParseErrorKind::UnexpectedWhitespace, 7..8);
    case!("<div a= {{b}}/>", r#"<div a={{b}}></div>"#, ParseErrorKind::UnexpectedWhitespace, 7..8);
    case!("<div a=>", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
    case!("<div a=/>", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
    case!("<div a=", r#"<div></div>"#, ParseErrorKind::MissingAttributeValue, 7..7);
    case!("<div #@></div>", r#"<div></div>"#, ParseErrorKind::IllegalAttributeName, 5..7);
    case!("<div a a></div>", r#"<div></div>"#, ParseErrorKind::DuplicatedAttribute, 7..8);
    case!("<template name='a'/><template name='a'/>", r#"<block wx:if=""></block><block wx:else></block>"#, ParseErrorKind::DuplicatedName, 36..37);
    case!("<block a=''></block>", r#"<block></block>"#, ParseErrorKind::InvalidAttribute, 7..8);
    case!("<block wx:if=''/><block wx:else=' '/>", r#"<block wx:if=""></block><block wx:else></block>"#, ParseErrorKind::InvalidAttributeValue, 33..34);
    case!("<slot><div/></slot>", r#"<slot></slot>"#, ParseErrorKind::InvalidAttribute, 6..12);
    case!("<div></div  a=''>", r#"<slot></slot>"#, ParseErrorKind::IllegalCharacter, 12..16);
    case!("<template name='a' wx:for='' />", r#"<template name="a"/>"#, ParseErrorKind::InvalidAttribute, 22..25);
    case!("<template name='a' wx:if='' />", r#"<template name="a"/>"#, ParseErrorKind::InvalidAttribute, 22..24);
    case!("<div wx:for='' wx:else />", r#"<div wx:for=''/>"#, ParseErrorKind::InvalidAttribute, 18..22);
}

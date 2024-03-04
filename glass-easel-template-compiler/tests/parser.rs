use glass_easel_template_compiler::*;

#[test]
fn value_parsing() {
    case!("{ {", r#"{ {"#);
    case!("{{ a } }", "", ParseErrorKind::MissingExpressionEnd, 8..8);
    case!("{{ a b }}", "", ParseErrorKind::IllegalExpression, 5..7);
    case!(" a\t{{ b }}", r#"{{"a\t"+b}}"#);
    case!("{{ b }} a ", r#"{{b+' a '}}"#);
    case!("{{ a }}{{ b }}", r#"{{a+b}}"#);

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
    case!("<div/ ></div>", r#"<div></div>"#, ParseErrorKind::UnexpectedCharacter, 4..5);
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
    case!("<div></div  a=''>", r#"<slot></slot>"#, ParseErrorKind::UnexpectedCharacter, 12..16);
    case!("<template name='a' wx:for='' />", r#"<template name="a"/>"#, ParseErrorKind::InvalidAttribute, 22..25);
    case!("<template name='a' wx:if='' />", r#"<template name="a"/>"#, ParseErrorKind::InvalidAttribute, 22..24);
    case!("<div wx:for='' wx:else />", r#"<div wx:for=''/>"#, ParseErrorKind::InvalidAttribute, 18..22);
}

#[test]
fn lit_parsing() {
    case!("{{ '", "", ParseErrorKind::MissingExpressionEnd, 4..4);
    case!(r#"{{ 'a\n\u0041\x4f\x4E' }}"#, "{{\"a\nAON\"}}");
    case!(r#"{{ 'a\n\u0' }}"#, "{{\"a\nAON\"}}");

    case!(r#"{{ 0 }}"#, r#"{{0}}"#);
    case!(r#"{{ 08 }}"#, r#"{&#38; 08 }}"#, ParseErrorKind::UnexpectedCharacter, 4..4);
    case!(r#"{{ 010 }}"#, r#"{{8}}"#);
    case!(r#"{{ 0x }}"#, r#"{&#38; 0x }}"#, ParseErrorKind::UnexpectedCharacter, 5..5);
    case!(r#"{{ 0xaB }}"#, r#"{{171}}"#);
    case!(r#"{{ 0e }}"#, r#"{&#38; 0e }}"#, ParseErrorKind::UnexpectedCharacter, 5..5);
    case!(r#"{{ 0e- }}"#, r#"{&#38; 0e- }}"#, ParseErrorKind::UnexpectedCharacter, 6..6);
    case!(r#"{{ 0e12 }}"#, r#"{{0}}"#);
    case!(r#"{{ 102 }}"#, r#"{{102}}"#);
    case!(r#"{{ 0.1 }}"#, r#"{{0.1}}"#);
    case!(r#"{{ .1 }}"#, r#"{{0.1}}"#);
    case!(r#"{{ 1. }}"#, r#"{{1.0}}"#);
    case!(r#"{{ 1.2e1 }}"#, r#"{{12}}"#);
    case!(r#"{{ 1.2e01 }}"#, r#"{{12}}"#);
    case!(r#"{{ 1.2e-1 }}"#, r#"{{0.12}}"#);

    case!(r#"{{ a }}"#, r#"{{{a:a}}}"#);
    case!(r#"{{ { a# } }}"#, r#"{&#38; { a# } }}"#, ParseErrorKind::UnexpectedCharacter, 6..6);
    case!(r#"{{ { a:# } }}"#, r#"{&#38; { a:# } }}"#, ParseErrorKind::UnexpectedCharacter, 7..7);
    case!(r#"{{ { } }}"#, r#"{{{}}}"#);
    case!(r#"{{ {,} }}"#, r#"{&#38; {,} }}"#, ParseErrorKind::UnexpectedCharacter, 4..4);
    case!(r#"{{ a: 1, a: 2 }}"#, r#"{{{a:1,a:2}}}"#, ParseErrorKind::DuplicatedName, 3..4);
    case!(r#"{{ a: 1, a }}"#, r#"{{{a:1,a}}}"#, ParseErrorKind::DuplicatedName, 3..4);
    case!(r#"{{ a: 1 }}"#, r#"{{{a:1}}}"#);
    case!(r#"{{ a: 2, }}"#, r#"{{{a:2}}}"#);
    case!(r#"{{ a: 2, b: 3 }}"#, r#"{{{a:2,b:3}}}"#);
    case!(r#"{{ a, }}"#, r#"{{{a:a}}}"#);
    case!(r#"{{ ...a, ...b }}"#, r#"{{{...a,...b}}}"#);
    case!(r#"{{ {...} }}"#, r#"{&#38; {...} }}"#, ParseErrorKind::UnexpectedCharacter, 7..7);

    case!(r#"{{ [ a, ] }}"#, r#"{{[a]}}"#);
    case!(r#"{{ [ a# ] }}"#, r#"{&#38; [ a# ] }}"#, ParseErrorKind::UnexpectedCharacter, 6..6);
    case!(r#"{{ [ , ] }}"#, r#"{{[,]}}"#);
    case!(r#"{{ [ , , ] }}"#, r#"{{[,,]}}"#);
    case!(r#"{{ [ c, a + b ] }}"#, r#"{{[c,a+b]}}"#);
    case!(r#"{{ [ ...a, ] }}"#, r#"{{[...a]}}"#);
    case!(r#"{{ [ ...a, ...b ] }}"#, r#"{{[...a,...b]}}"#);
    case!(r#"{{ [...] }}"#, r#"{{[...]}}"#, ParseErrorKind::UnexpectedCharacter, 7..7);
}

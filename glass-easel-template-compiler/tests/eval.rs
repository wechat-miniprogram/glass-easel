use glass_easel_template_compiler::*;

#[test]
fn basic_eval() {
    const SRC: &str = r#"<b a="{{ "" }}" />"#;
    const GEN: &str = r#"<b a="{{""}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn member() {
    const SRC: &str = r#"<b a="{{ a.a2 + b[4 + 1 - 5] + {c1: true}['c1'] + [null, '2'][1] }}" />"#;
    const GEN: &str = r#"<b a="{{X(a).a2+X(b)[4+1-5]+X({c1:true})["c1"]+X([null,"2"])[1]}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn unary() {
    const SRC: &str = r#"<b a="{{ - a + - 2 + + 3 + !!b }}" />"#;
    const GEN: &str = r#"<b a="{{-a+-2++3+!!b}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn number_plus() {
    const SRC: &str = r#"<b a="{{ a - 2 * b + 3 }}" />"#;
    const GEN: &str = r#"<b a="{{a-2*b+3}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn string_plus() {
    const SRC: &str = r#"<b a="{{ a + (b + 2.1) }}" />"#;
    const GEN: &str = r#"<b a="{{a+(b+2.1)}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn multiply() {
    const SRC: &str = r#"<b a="{{ a % '2' * (b / 4)  }}" />"#;
    const GEN: &str = r#"<b a="{{a%"2"*(b/4)}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn comparison() {
    const SRC: &str = r#"<b a="{{ a > b ? true : false }} {{ a >= b ? true : false }} {{ c < d }} {{ c <= d }}" />"#;
    const GEN: &str =
        r#"<b a="{{Y(a>b?true:false)+" "+Y(a>=b?true:false)+" "+Y(c<d)+" "+Y(c<=d)}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn equality() {
    const SRC: &str = r#"<b a="{{ a == b }} {{ a === b }} {{ a != b }} {{ a !== b }}" />"#;
    const GEN: &str = r#"<b a="{{Y(a==b)+" "+Y(a===b)+" "+Y(a!=b)+" "+Y(a!==b)}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn logic() {
    const SRC: &str = r#"<b a="{{a || b && c || d}}" />"#;
    const GEN: &str = r#"<b a="{{a||b&&c||d}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn condition() {
    const SRC: &str = r#"<b a="{{a ? b : c ? d : e}}" />"#;
    const GEN: &str = r#"<b a="{{a?b:c?d:e}}"></b>"#;
    let tree = parse_tmpl(SRC, r#""#).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

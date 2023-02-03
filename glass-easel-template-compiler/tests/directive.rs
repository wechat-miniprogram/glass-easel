use glass_easel_template_compiler::*;

#[test]
fn lonely_if() {
    const SRC: &str = r#"<b wx:if="{{a}}">{{a}}<b wx:if="{{!a}}">{{a}}</b></b>"#;
    const GEN: &str =
        r#"<block wx:if="{{a}}"><b>{{a}}<block wx:if="{{!a}}"><b>{{a}}</b></block></b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn if_else() {
    const SRC: &str = r#"<b wx:if="{{a}}">1</b><b wx:else>2</b>"#;
    const GEN: &str = r#"<block wx:if="{{a}}"><b>1</b></block><block wx:else><b>2</b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn if_elif_else() {
    const SRC: &str = r#"<b wx:if="{{a}}">1</b><b wx:elif="{{a + 1}}">2</b><b wx:else>3</b>"#;
    const GEN: &str = r#"<block wx:if="{{a}}"><b>1</b></block><block wx:elif="{{a+1}}"><b>2</b></block><block wx:else><b>3</b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn for_array() {
    const SRC: &str = r#"<b wx:for="{{list}}" wx:key="v" a="{{index}}">{{item.v}}</b>"#;
    const GEN: &str = r#"<block wx:for="{{list}}" wx:for-item="$0" wx:for-index="$1" wx:key="v"><b a="{{$1}}">{{X($0).v}}</b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn for_object() {
    const SRC: &str = r#"<b wx:for="{{list}}" wx:key="*this" a="{{index}}">{{item}}</b>"#;
    const GEN: &str = r#"<block wx:for="{{list}}" wx:for-item="$0" wx:for-index="$1" wx:key="*this"><b a="{{$1}}">{{$0}}</b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

#[test]
fn for_string() {
    const SRC: &str = r#"<b wx:for="abc" a="{{index}}">{{item}}</b>"#;
    const GEN: &str = r#"<block wx:for="abc" wx:for-item="$0" wx:for-index="$1"><b a="{{$1}}">{{$0}}</b></block>"#;
    let tree = parse_tmpl(SRC).unwrap();
    assert_eq!(tree.to_string(), GEN);
}

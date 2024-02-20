use std::ops::Range;

use compact_str::CompactString;

use super::Position;

#[derive(Debug, Clone)]
pub enum Expression {
    ScopeRef {
        index: usize,
        location: Range<Position>,
    },
    Ident {
        name: CompactString,
        location: Range<Position>,
    },
    ToStringWithoutUndefined {
        value: Box<Expression>,
        location: Range<Position>,
    },

    LitUndefined {
        location: Range<Position>,
    },
    LitNull {
        location: Range<Position>,
    },
    LitStr {
        value: CompactString,
        location: Range<Position>,
    },
    LitInt {
        value: i32,
        location: Range<Position>,
    },
    LitFloat {
        value: f64,
        location: Range<Position>,
    },
    LitBool {
        value: bool,
        location: Range<Position>,
    },
    LitObj {
        fields: Vec<(Option<CompactString>, Expression)>, // None refers to spread op
        brace_location: (Range<Position>, Range<Position>),
    },
    LitArr {
        fields: Vec<Expression>,
        bracket_location: (Range<Position>, Range<Position>),
    },

    StaticMember {
        obj: Box<Expression>,
        field_name: CompactString,
        location: Range<Position>,
    },
    DynamicMember {
        obj: Box<Expression>,
        field_name: Box<Expression>,
        bracket_location: (Range<Position>, Range<Position>),
    },
    FuncCall {
        func: Box<Expression>,
        args: Vec<Expression>,
        paren_location: (Range<Position>, Range<Position>),
    },

    Reverse {
        value: Box<Expression>,
        location: Range<Position>,
    },
    BitReverse {
        value: Box<Expression>,
        location: Range<Position>,
    },
    Positive {
        value: Box<Expression>,
        location: Range<Position>,
    },
    Negative {
        value: Box<Expression>,
        location: Range<Position>,
    },
    TypeOf {
        value: Box<Expression>,
        location: Range<Position>,
    },
    Void {
        value: Box<Expression>,
        location: Range<Position>,
    },

    Multiply {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Divide {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Mod {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Plus {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Minus {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },

    Lt {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Gt {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Lte {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Gte {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Eq {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    Ne {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    EqFull {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    NeFull {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },

    BitAnd {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    BitXor {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    BitOr {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    LogicAnd {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },
    LogicOr {
        left: Box<Expression>,
        right: Box<Expression>,
        location: Range<Position>,
    },

    Cond {
        cond: Box<Expression>,
        true_br: Box<Expression>,
        false_br: Box<Expression>,
        question_location: Range<Position>,
        colon_location: Range<Position>,
    },
}

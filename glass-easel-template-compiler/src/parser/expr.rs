use std::ops::Range;

use compact_str::CompactString;

use super::{ParseState, Position, TemplateStructure, ParseErrorKind};

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
        fields: Vec<(Option<(CompactString, Range<Position>)>, Expression)>, // None refers to spread op
        brace_location: (Range<Position>, Range<Position>),
    },
    LitArr {
        fields: Vec<Expression>,
        bracket_location: (Range<Position>, Range<Position>),
    },

    StaticMember {
        obj: Box<Expression>,
        field_name: CompactString,
        field_location: Range<Position>,
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

impl TemplateStructure for Expression {
    fn location(&self) -> Range<Position> {
        self.location_start()..self.location_end()
    }

    fn location_start(&self) -> Position {
        match self {
            Self::ScopeRef { location, .. } => location.start,
            Self::Ident { location, .. } => location.start,
            Self::ToStringWithoutUndefined { location, .. } => location.start,
            Self::LitUndefined { location, .. } => location.start,
            Self::LitNull { location, .. } => location.start,
            Self::LitStr { location, .. } => location.start,
            Self::LitInt { location, .. } => location.start,
            Self::LitFloat { location, .. } => location.start,
            Self::LitBool { location, .. } => location.start,
            Self::LitObj { brace_location, .. } => brace_location.0.start,
            Self::LitArr { bracket_location, .. } => bracket_location.0.start,
            Self::StaticMember { obj, .. } => obj.location_start(),
            Self::DynamicMember { obj, .. } => obj.location_start(),
            Self::FuncCall { func, .. } => func.location_start(),
            Self::Reverse { location, .. } => location.start,
            Self::BitReverse { location, .. } => location.start,
            Self::Positive { location, .. } => location.start,
            Self::Negative { location, .. } => location.start,
            Self::TypeOf { location, .. } => location.start,
            Self::Void { location, .. } => location.start,
            Self::Multiply { left, .. } => left.location_start(),
            Self::Divide { left, .. } => left.location_start(),
            Self::Mod { left, .. } => left.location_start(),
            Self::Plus { left, .. } => left.location_start(),
            Self::Minus { left, .. } => left.location_start(),
            Self::Lt { left, .. } => left.location_start(),
            Self::Gt { left, .. } => left.location_start(),
            Self::Lte { left, .. } => left.location_start(),
            Self::Gte { left, .. } => left.location_start(),
            Self::Eq { left, .. } => left.location_start(),
            Self::Ne { left, .. } => left.location_start(),
            Self::EqFull { left, .. } => left.location_start(),
            Self::NeFull { left, .. } => left.location_start(),
            Self::BitAnd { left, .. } => left.location_start(),
            Self::BitXor { left, .. } => left.location_start(),
            Self::BitOr { left, .. } => left.location_start(),
            Self::LogicAnd { left, .. } => left.location_start(),
            Self::LogicOr { left, .. } => left.location_start(),
            Self::Cond { cond, .. } => cond.location_start(),
        }
    }

    fn location_end(&self) -> Position {
        match self {
            Self::ScopeRef { location, .. } => location.end,
            Self::Ident { location, .. } => location.end,
            Self::ToStringWithoutUndefined { location, .. } => location.end,
            Self::LitUndefined { location, .. } => location.end,
            Self::LitNull { location, .. } => location.end,
            Self::LitStr { location, .. } => location.end,
            Self::LitInt { location, .. } => location.end,
            Self::LitFloat { location, .. } => location.end,
            Self::LitBool { location, .. } => location.end,
            Self::LitObj { brace_location, .. } => brace_location.1.end,
            Self::LitArr { bracket_location, .. } => bracket_location.1.end,
            Self::StaticMember { obj, .. } => obj.location_end(),
            Self::DynamicMember { obj, .. } => obj.location_end(),
            Self::FuncCall { func, .. } => func.location_end(),
            Self::Reverse { location, .. } => location.end,
            Self::BitReverse { location, .. } => location.end,
            Self::Positive { location, .. } => location.end,
            Self::Negative { location, .. } => location.end,
            Self::TypeOf { location, .. } => location.end,
            Self::Void { location, .. } => location.end,
            Self::Multiply { right, .. } => right.location_end(),
            Self::Divide { right, .. } => right.location_end(),
            Self::Mod { right, .. } => right.location_end(),
            Self::Plus { right, .. } => right.location_end(),
            Self::Minus { right, .. } => right.location_end(),
            Self::Lt { right, .. } => right.location_end(),
            Self::Gt { right, .. } => right.location_end(),
            Self::Lte { right, .. } => right.location_end(),
            Self::Gte { right, .. } => right.location_end(),
            Self::Eq { right, .. } => right.location_end(),
            Self::Ne { right, .. } => right.location_end(),
            Self::EqFull { right, .. } => right.location_end(),
            Self::NeFull { right, .. } => right.location_end(),
            Self::BitAnd { right, .. } => right.location_end(),
            Self::BitXor { right, .. } => right.location_end(),
            Self::BitOr { right, .. } => right.location_end(),
            Self::LogicAnd { right, .. } => right.location_end(),
            Self::LogicOr { right, .. } => right.location_end(),
            Self::Cond { false_br, .. } => false_br.location_end(),
        }
    }
}

impl Expression {
    pub(super) fn parse_expression_or_object_inner(ps: &mut ParseState) -> Option<Box<Self>> {
        let mut is_object_inner = false;
        ps.try_parse(|ps| -> Option<()> {
            // try parse as an object
            Self::try_parse_ident_or_keyword(ps)?;
            let peek = ps.peek_without_whitespace()?;
            if peek != ':' && peek != ',' { return None };
            is_object_inner = true;
            None
        });
        if is_object_inner {
            parse_object_inner(ps)
        } else {
            parse_cond(ps)
        }
    }

    fn try_parse_ident_or_keyword(ps: &mut ParseState) -> Option<Box<Self>> {
        let peek = ps.peek_without_whitespace()?;
        if peek == '_' || ('a'..='z').contains(&peek) || ('A'..='Z').contains(&peek) {
            ps.skip_whitespace();
            let pos = ps.position();
            let mut name = CompactString::new_inline("");
            loop {
                name.push(ps.next_with_whitespace().unwrap());
                let Some(peek) = ps.peek_with_whitespace() else { break };
                if peek == '_' || ('a'..='z').contains(&peek) || ('A'..='Z').contains(&peek) || ('0'..='9').contains(&peek) {
                    // empty
                } else {
                    break;
                }
            }
            Some(Box::new(Self::Ident { name, location: pos..ps.position() }))
        } else {
            None
        }
    }

    fn parse_object_inner(ps: &mut ParseState) -> Option<Box<Self>> {
        // TODO
    }

    fn parse_lit_str(ps: &mut ParseState) -> Option<Box<Self>> {
        let peek = ps.peek_without_whitespace()?;
        if peek != '"' && peek != '\'' { return None; }
        ps.skip_whitespace();
        let pos = ps.position();
        ps.next_with_whitespace(); // peek
        let mut ret = CompactString::new_inline("");
        loop {
            let next = ps.next_with_whitespace()?;
            if next == peek { break };
            if next == '\\' {
                let next = ps.next_with_whitespace()?;
                let ch = match next {
                    'r' => '\r',
                    'n' => '\n',
                    't' => '\t',
                    'b' => '\x08',
                    'f' => '\x0C',
                    'v' => '\x0B',
                    '0' => '\0',
                    'x' | 'u' => {
                        let range = if next == 'x' { 0..2 } else { 0..4 };
                        let pos = ps.position();
                        let ch = ps.try_parse(|ps| {
                            let mut v = 0;
                            for _ in range {
                                let next = ps.next_with_whitespace()?;
                                let x = match next {
                                    '0' => 0,
                                    '1' => 1,
                                    '2' => 2,
                                    '3' => 3,
                                    '4' => 4,
                                    '5' => 5,
                                    '6' => 6,
                                    '7' => 7,
                                    '8' => 8,
                                    '9' => 9,
                                    'a' | 'A' => 10,
                                    'b' | 'B' => 11,
                                    'c' | 'C' => 12,
                                    'd' | 'D' => 13,
                                    'e' | 'E' => 14,
                                    'f' | 'F' => 15,
                                    _ => {
                                        ps.add_warning(ParseErrorKind::IllegalEscapeSequence, pos..ps.position());
                                        return None;
                                    }
                                };
                                v = v * 16 + x;
                            }
                            let Some(ch) = char::from_u32(v) else {
                                ps.add_warning(ParseErrorKind::IllegalEscapeSequence, pos..ps.position());
                                return None;
                            };
                            Some(ch)
                        });
                        ch.unwrap_or(' ')
                    }
                    x => x,
                };
                ret.push(ch);
            } else {
                ret.push(next);
            }
        }
        Some(Box::new(Expression::LitStr { value: ret, location: pos..ps.position() }))
    }
}

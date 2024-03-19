use std::ops::Range;

use compact_str::CompactString;

use super::{ParseState, Position, TemplateStructure, ParseErrorKind};

#[derive(Debug, Clone)]
pub enum Expression {
    ScopeRef {
        name: CompactString,
        location: Range<Position>,
        index: usize,
    },
    Ident {
        name: CompactString,
        location: Range<Position>,
    },
    DataField {
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
        value: i64,
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
        fields: Vec<ObjectFieldKind>, // None refers to spread op
        brace_location: (Range<Position>, Range<Position>),
    },
    LitArr {
        fields: Vec<ArrayFieldKind>,
        bracket_location: (Range<Position>, Range<Position>),
    },

    StaticMember {
        obj: Box<Expression>,
        field_name: CompactString,
        dot_location: Range<Position>,
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
    Remainer {
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
    InstanceOf {
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
    NullishCoalescing {
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

#[derive(Debug, Clone)]
pub enum ObjectFieldKind {
    Named {
        name: CompactString,
        location: Range<Position>,
        colon_location: Range<Position>,
        value: Expression,
    },
    ShortcutNamed {
        name: CompactString,
        location: Range<Position>,
    },
    Spread {
        location: Range<Position>,
        value: Expression,
    },
}

#[derive(Debug, Clone)]
pub enum ArrayFieldKind {
    Normal {
        value: Expression,
    },
    Spread {
        location: Range<Position>,
        value: Expression,
    },
    EmptySlot,
}

impl TemplateStructure for Expression {
    fn location(&self) -> Range<Position> {
        self.location_start()..self.location_end()
    }

    fn location_start(&self) -> Position {
        match self {
            Self::ScopeRef { location, .. } => location.start,
            Self::Ident { location, .. } => location.start,
            Self::DataField { location, .. } => location.start,
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
            Self::Remainer { left, .. } => left.location_start(),
            Self::Plus { left, .. } => left.location_start(),
            Self::Minus { left, .. } => left.location_start(),
            Self::Lt { left, .. } => left.location_start(),
            Self::Gt { left, .. } => left.location_start(),
            Self::Lte { left, .. } => left.location_start(),
            Self::Gte { left, .. } => left.location_start(),
            Self::InstanceOf { left, .. } => left.location_start(),
            Self::Eq { left, .. } => left.location_start(),
            Self::Ne { left, .. } => left.location_start(),
            Self::EqFull { left, .. } => left.location_start(),
            Self::NeFull { left, .. } => left.location_start(),
            Self::BitAnd { left, .. } => left.location_start(),
            Self::BitXor { left, .. } => left.location_start(),
            Self::BitOr { left, .. } => left.location_start(),
            Self::LogicAnd { left, .. } => left.location_start(),
            Self::LogicOr { left, .. } => left.location_start(),
            Self::NullishCoalescing { left, .. } => left.location_start(),
            Self::Cond { cond, .. } => cond.location_start(),
        }
    }

    fn location_end(&self) -> Position {
        match self {
            Self::ScopeRef { location, .. } => location.end,
            Self::Ident { location, .. } => location.end,
            Self::DataField { location, .. } => location.end,
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
            Self::Remainer { right, .. } => right.location_end(),
            Self::Plus { right, .. } => right.location_end(),
            Self::Minus { right, .. } => right.location_end(),
            Self::Lt { right, .. } => right.location_end(),
            Self::Gt { right, .. } => right.location_end(),
            Self::Lte { right, .. } => right.location_end(),
            Self::Gte { right, .. } => right.location_end(),
            Self::InstanceOf { right, .. } => right.location_end(),
            Self::Eq { right, .. } => right.location_end(),
            Self::Ne { right, .. } => right.location_end(),
            Self::EqFull { right, .. } => right.location_end(),
            Self::NeFull { right, .. } => right.location_end(),
            Self::BitAnd { right, .. } => right.location_end(),
            Self::BitXor { right, .. } => right.location_end(),
            Self::BitOr { right, .. } => right.location_end(),
            Self::LogicAnd { right, .. } => right.location_end(),
            Self::LogicOr { right, .. } => right.location_end(),
            Self::NullishCoalescing { right, .. } => right.location_end(),
            Self::Cond { false_br, .. } => false_br.location_end(),
        }
    }
}

impl Expression {
    pub(super) fn parse_expression_or_object_inner(ps: &mut ParseState) -> Option<Box<Self>> {
        ps.parse_on_auto_whitespace(|ps| {
            let mut is_object_inner = false;
            ps.try_parse(|ps| -> Option<()> {
                // try parse as an object
                match Self::try_parse_field_name(ps) {
                    Some(_) => {
                        let peek = ps.peek::<0>()?;
                        if peek == ':' || peek == ',' {
                            is_object_inner = true;
                        }
                    }
                    None => {
                        if ps.peek_str("...") {
                            is_object_inner = true;
                        }
                    }
                }
                None
            });
            if is_object_inner {
                let pos = ps.position();
                let fields = Self::parse_object_inner(ps)?;
                let end_pos = ps.position();
                let brace_location = (pos.clone()..pos, end_pos.clone()..end_pos);
                Some(Box::new(Expression::LitObj { fields, brace_location }))
            } else {
                Self::parse_cond(ps)
            }
        })
    }

    fn try_parse_field_name(ps: &mut ParseState) -> Option<(CompactString, Range<Position>)> {
        let peek = ps.peek::<0>()?;
        if is_ident_start_char(peek) {
            ps.parse_off_auto_whitespace(|ps| {
                let pos = ps.position();
                let mut name = CompactString::new_inline("");
                loop {
                    name.push(ps.next().unwrap());
                    let Some(peek) = ps.peek::<0>() else { break };
                    if is_ident_char(peek) {
                        // empty
                    } else {
                        break;
                    }
                }
                Some((name, pos..ps.position() ))
            })
        } else {
            None
        }
    }

    // NOTE
    // each `parse_*` fn should return `None` if failed.
    // Unless the input is ended, a warning should be added before returns `None` .

    fn parse_ident_or_keyword(ps: &mut ParseState) -> Option<Box<Self>> {
        let Some((name, location)) = Self::try_parse_field_name(ps) else {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None; 
        };
        let ret = match name.as_str() {
            "undefined" => Expression::LitUndefined { location },
            "null" => Expression::LitNull { location },
            "true" => Expression::LitBool { value: true, location },
            "false" => Expression::LitBool { value: false, location },
            _ => Expression::Ident { name, location },
        };
        Some(Box::new(ret))
    }

    fn parse_object_inner(ps: &mut ParseState) -> Option<Vec<ObjectFieldKind>> {
        let mut fields = vec![];
        loop {
            let Some(peek) = ps.peek::<0>() else {
                break
            };
            if peek == '}' { break };

            // parse `...xxx`
            if peek == '.' {
                let Some(location) = ps.consume_str("...") else {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                    return None;
                };
                let value = *Self::parse_cond(ps)?;
                fields.push(ObjectFieldKind::Spread { location, value });
                let peek = ps.peek::<0>()?;
                if peek == '}' { break };
                if peek == ',' {
                    ps.next(); // ','
                    continue;
                }
                ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                return None;
            }

            // parse field name
            let Some((name, location)) = Self::try_parse_field_name(ps) else {
                ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                return None;
            };
            let dup_name = fields.iter().find_map(|x| match x {
                ObjectFieldKind::Named { name: x, location, .. } |
                ObjectFieldKind::ShortcutNamed { name: x, location } => (x == &name).then_some(location.clone()),
                ObjectFieldKind::Spread { .. } => None,
            });
            if let Some(location) = dup_name {
                ps.add_warning(ParseErrorKind::DuplicatedName, location);
            };

            // parse field value if needed
            let peek = ps.peek::<0>();
            match peek {
                Some(':') => {
                    let colon_location = ps.consume_str(":").unwrap(); // ':'
                    let value = *Self::parse_cond(ps)?;
                    fields.push(ObjectFieldKind::Named { name, location, colon_location, value });
                    let peek = ps.peek::<0>()?;
                    if peek == '}' { break };
                    if peek == ',' {
                        ps.next(); // ','
                    } else {
                        ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                        return None;
                    }
                }
                None | Some('}') | Some(',') => {
                    fields.push(ObjectFieldKind::ShortcutNamed { name, location });
                    if peek == Some(',') {
                        ps.next(); // ','
                    }
                }
                _ => {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                    return None;
                }
            }
        }
        Some(fields)
    }

    fn parse_lit_object(ps: &mut ParseState) -> Option<Box<Self>> {
        let Some(brace_start_location) = ps.consume_str("{") else {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None
        };
        let fields = Self::parse_object_inner(ps)?;
        let Some(brace_end_location) = ps.consume_str("}") else {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None;
        };
        Some(Box::new(Self::LitObj { fields, brace_location: (brace_start_location, brace_end_location) }))
    }

    fn parse_array_inner(ps: &mut ParseState) -> Option<Vec<ArrayFieldKind>> {
        let mut items = vec![];
        loop {
            let Some(peek) = ps.peek::<0>() else {
                break
            };
            if peek == ']' { break };

            // parse empty slot
            if peek == ',' {
                items.push(ArrayFieldKind::EmptySlot);
                ps.next(); // ','
                continue;
            }

            // parse `...xxx`
            if peek == '.' {
                let Some(location) = ps.consume_str("...") else {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                    return None;
                };
                let value = *Self::parse_cond(ps)?;
                items.push(ArrayFieldKind::Spread { location, value });
                let peek = ps.peek::<0>()?;
                if peek == ']' { break };
                if peek == ',' {
                    ps.next(); // ','
                } else {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                    return None;
                }
                continue;
            }

            // parse item
            let value = *Self::parse_cond(ps)?;
            items.push(ArrayFieldKind::Normal { value });
            let peek = ps.peek::<0>()?;
            if peek == ']' { break };
            if peek == ',' {
                ps.next(); // ','
            } else {
                ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                return None;
            }
        }
        Some(items)
    }

    fn parse_lit_array(ps: &mut ParseState) -> Option<Box<Self>> {
        let Some(brace_start_location) = ps.consume_str("[") else {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None;
        };
        let fields = Self::parse_array_inner(ps)?;
        let Some(brace_end_location) = ps.consume_str("]") else {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None;
        };
        Some(Box::new(Self::LitArr { fields, bracket_location: (brace_start_location, brace_end_location) }))
    }

    fn parse_lit_str(ps: &mut ParseState) -> Option<Box<Self>> {
        let peek = ps.peek::<0>()?;
        if peek != '"' && peek != '\'' {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None;
        }
        let pos = ps.position();
        ps.next(); // peek
        ps.parse_off_auto_whitespace(|ps| {
            let mut ret = CompactString::new_inline("");
            loop {
                let next = ps.next()?;
                if next == peek { break };
                if next == '\\' {
                    let next = ps.next()?;
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
                                    let next = ps.next()?;
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
        })
    }

    fn parse_number(ps: &mut ParseState) -> Option<Box<Self>> {
        let peek = ps.peek::<0>()?;
        if !('0'..='9').contains(&peek) && peek != '.' {
            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
            return None;
        }
        let pos = ps.position();
        let start_index = ps.cur_index();
        ps.parse_off_auto_whitespace(|ps| {
            // parse zero-leading sequence
            if peek == '0' {
                ps.next(); // '0'
                match ps.peek::<0>() {
                    Some(d) if ('0'..='7').contains(&d) => {
                        // parse as OCT
                        let mut num = 0i64;
                        loop {
                            let d = ps.next().unwrap() as i64 - '0' as i64;
                            num = num * 8 + d;
                            let Some(peek) = ps.peek::<0>() else { break };
                            if !is_ident_char(peek) { break }
                            if !('0'..='7').contains(&peek) {
                                ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                                return None;
                            }
                        }
                        return Some(Box::new(Expression::LitInt { value: num, location: pos..ps.position() }));
                    }
                    Some('x') => {
                        // parse as HEX
                        ps.next(); // 'x'
                        let mut num = 0i64;
                        let peek = ps.peek::<0>()?;
                        if !('0'..='9').contains(&peek) && !('a'..='z').contains(&peek) && !('A'..='Z').contains(&peek) {
                            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                            return None;
                        }
                        loop {
                            let ch = ps.next().unwrap();
                            let d = match ch {
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
                                _ => unreachable!(),
                            };
                            num = num * 16 + d;
                            let Some(peek) = ps.peek::<0>() else { break };
                            if !is_ident_char(peek) { break }
                            if !('0'..='9').contains(&peek) && !('a'..='z').contains(&peek) && !('A'..='Z').contains(&peek) {
                                ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                                return None;
                            }
                        }
                        return Some(Box::new(Expression::LitInt { value: num, location: pos..ps.position() }));
                    }
                    Some('e') | Some('.') | Some('8') | Some('9') => {
                        // do nothing
                    }
                    Some(x) if is_ident_char(x) => {
                        ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                        return None;
                    }
                    _ => {
                        return Some(Box::new(Expression::LitInt { value: 0, location: pos..ps.position() }));
                    }
                }
            }

            // parse as normal DEC
            let mut int = Some(0);
            loop {
                let next = ps.next().unwrap();
                if next == 'e' {
                    int = None;
                    ps.consume_str("-");
                    let peek = ps.peek::<0>()?;
                    if !('0'..='9').contains(&peek) {
                        ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                        return None;
                    }
                    loop {
                        ps.next();
                        let Some(peek) = ps.peek::<0>() else { break };
                        if !is_ident_char(peek) { break; }
                        if !('0'..='9').contains(&peek) {
                            ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                            return None;
                        }
                    }
                    break;
                }
                if next == '.' {
                    int = None;
                } else {
                    // '0'..='9'
                    if let Some(x) = int.as_mut() {
                        let d = next as i64 - '0' as i64;
                        *x = *x * 10 + d;
                    }
                }
                let Some(peek) = ps.peek::<0>() else { break };
                if !is_ident_char(peek) && peek != '.' { break }
                if ('0'..='9').contains(&peek) || (int.is_some() && peek == '.') || peek == 'e' {
                    // empty
                } else {
                    ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                    return None;
                }
            }
            let num = match int {
                None => {
                    let Ok(num) = ps.code_slice(start_index..ps.cur_index()).parse::<f64>() else {
                        ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
                        return None;
                    };
                    Expression::LitFloat { value: num, location: pos..ps.position() }
                }
                Some(int) => Expression::LitInt { value: int, location: pos..ps.position() },
            };
            Some(Box::new(num))
        })
    }

    fn parse_lit(ps: &mut ParseState) -> Option<Box<Self>> {
        let ch = ps.peek::<0>()?;
        if is_ident_start_char(ch) {
            return Self::parse_ident_or_keyword(ps);
        }
        if ch == '"' || ch == '\'' {
            return Self::parse_lit_str(ps);
        }
        if ('0'..='9').contains(&ch) || ch == '.' {
            return Self::parse_number(ps);
        }
        if ch == '(' {
            ps.next(); // '('
            let ret = Self::parse_cond(ps)?;
            if ps.consume_str(")").is_none() {
                ps.add_warning_at_current_position(ParseErrorKind::UnmatchedParenthesis);
                return None;
            }
            return Some(ret);
        }
        if ch == '{' {
            return Self::parse_lit_object(ps);
        }
        if ch == '[' {
            return Self::parse_lit_array(ps);
        }
        ps.add_warning_at_current_position(ParseErrorKind::UnexpectedCharacter);
        None
    }

    fn parse_member(ps: &mut ParseState) -> Option<Box<Self>> {
        let mut obj = Self::parse_lit(ps)?;
        loop {
            if let Some(dot_location) = ParseOperator::static_member(ps) {
                let Some((field_name, field_location)) = Self::try_parse_field_name(ps) else {
                    ps.add_warning_at_current_position(ParseErrorKind::InvalidIdentifier);
                    return None;
                };
                obj = Box::new(Self::StaticMember { obj, field_name, dot_location, field_location});
                continue;
            }
            if let Some(start) = ParseOperator::dynamic_member(ps) {
                let field_name = Self::parse_cond(ps)?;
                let Some(end) = ParseOperator::dynamic_member_end(ps) else {
                    if !ps.ended() {
                        ps.add_warning_at_current_position(ParseErrorKind::UnmatchedBracket);
                    }
                    return None;
                };
                obj = Box::new(Self::DynamicMember { obj, field_name, bracket_location: (start, end)});
                continue;
            }
            if let Some(start) = ParseOperator::func_call(ps) {
                let mut args = vec![];
                loop {
                    if ps.peek::<0>()? == ')' {
                        break;
                    }
                    let value = *Self::parse_cond(ps)?;
                    args.push(value);
                    if ps.consume_str(",").is_none() {
                        break;
                    }
                }
                let Some(end) = ParseOperator::func_call_end(ps) else {
                    if !ps.ended() {
                        ps.add_warning_at_current_position(ParseErrorKind::UnmatchedParenthesis);
                    }
                    return None;
                };
                obj = Box::new(Self::FuncCall { func: obj, args, paren_location: (start, end)});
                continue;
            }
            break;
        }
        Some(obj)
    }

    fn parse_reverse(ps: &mut ParseState) -> Option<Box<Self>> {
        if let Some(location) = ParseOperator::reverse(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::Reverse { value, location }));
        }
        if let Some(location) = ParseOperator::bit_reverse(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::BitReverse { value, location }));
        }
        if let Some(location) = ParseOperator::positive(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::Positive { value, location }));
        }
        if let Some(location) = ParseOperator::negative(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::Negative { value, location }));
        }
        if let Some(location) = ParseOperator::r#typeof(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::TypeOf { value, location }));
        }
        if let Some(location) = ParseOperator::void(ps) {
            let value = Self::parse_reverse(ps)?;
            return Some(Box::new(Self::Void { value, location }));
        }
        Self::parse_member(ps)
    }

    fn parse_cond(ps: &mut ParseState) -> Option<Box<Self>> {
        let cond = Self::parse_logic_or(ps)?;
        let Some(question_location) = ParseOperator::condition(ps) else {
            return Some(cond);
        };
        let true_br = Self::parse_cond(ps)?;
        let Some(colon_location) = ParseOperator::condition_end(ps) else {
            ps.add_warning_at_current_position(ParseErrorKind::IncompleteConditionExpression);
            return None;
        };
        let false_br = Self::parse_cond(ps)?;
        Some(Box::new(Self::Cond { cond, true_br, false_br, question_location, colon_location }))
    }
}

macro_rules! parse_left_to_right {
    ($cur_level:ident, $next_level:ident, $($op:ident => $br:ident),*) => {
        impl Expression {
            fn $cur_level(ps: &mut ParseState) -> Option<Box<Self>> {
                let mut left = Self::$next_level(ps)?;
                loop {
                    $(
                        if let Some(location) = ParseOperator::$op(ps) {
                            let right = Self::$next_level(ps)?;
                            left = Box::new(Expression::$br { left, right, location });
                            continue;
                        }
                    )*
                    break;
                }
                Some(left)
            }
        }
    };
}

parse_left_to_right!(parse_multiply, parse_reverse, multiply => Multiply, divide => Divide, remainer => Remainer);
parse_left_to_right!(parse_plus, parse_multiply, plus => Plus, minus => Minus);
parse_left_to_right!(parse_cmp, parse_plus, lt => Lt, gt => Gt, lte => Lte, gte => Gte, instanceof => InstanceOf);
parse_left_to_right!(parse_eq, parse_cmp, eq => Eq, ne => Ne, eq_full => EqFull, ne_full => NeFull);
parse_left_to_right!(parse_bit_and, parse_eq, bit_and => BitAnd);
parse_left_to_right!(parse_bit_xor, parse_bit_and, bit_xor => BitXor);
parse_left_to_right!(parse_bit_or, parse_bit_xor, bit_or => BitOr);
parse_left_to_right!(parse_logic_and, parse_bit_or, logic_and => LogicAnd);
parse_left_to_right!(parse_logic_or, parse_logic_and, logic_or => LogicOr, nullish_coalescing => NullishCoalescing);

struct ParseOperator();

macro_rules! define_operator {
    ($name:ident, $s:expr, $excepts:expr) => {
        impl ParseOperator {
            fn $name(ps: &mut ParseState) -> Option<Range<Position>> {
                ps.consume_str_except_followed($s, $excepts)
            }
        }
    };
    ($name:ident, $s:expr) => {
        impl ParseOperator {
            fn $name(ps: &mut ParseState) -> Option<Range<Position>> {
                ps.consume_str_except_followed_char($s, is_ident_char)
            }
        }
    };
}

define_operator!(static_member, ".", [".."]);
define_operator!(dynamic_member, "[", []);
define_operator!(dynamic_member_end, "]", []);
define_operator!(func_call, "(", []);
define_operator!(func_call_end, ")", []);
// `?.` is not supported
// `new` is treated as an identifier

// `++` `--` are not allowed

define_operator!(reverse, "!", []);
define_operator!(bit_reverse, "~", []);
define_operator!(positive, "+", ["+", "="]);
define_operator!(negative, "-", ["-", "="]);
define_operator!(r#typeof, "typeof");
define_operator!(void, "void");
// `delete` `await` are treated as identifiers

// `**` is not supported

define_operator!(multiply, "*", ["*", "="]);
define_operator!(divide, "/", ["/", "="]);
define_operator!(remainer, "%", ["="]);

define_operator!(plus, "+", ["+", "="]);
define_operator!(minus, "-", ["-", "="]);

// `<<` `>>` `>>>` are not supported

define_operator!(lt, "<", ["<", "="]);
define_operator!(lte, "<=", []);
define_operator!(gt, ">", [">", "="]);
define_operator!(gte, ">=", []);
define_operator!(instanceof, "instanceof");
// `in` is treated as an identifier

define_operator!(eq, "==", ["="]);
define_operator!(ne, "!=", ["="]);
define_operator!(eq_full, "===", []);
define_operator!(ne_full, "!==", []);

define_operator!(bit_and, "&", ["&", "="]);

define_operator!(bit_xor, "^", ["="]);

define_operator!(bit_or, "|", ["|", "="]);

define_operator!(logic_and, "&&", ["="]);

define_operator!(logic_or, "||", ["="]);
define_operator!(nullish_coalescing, "??", ["="]);

define_operator!(condition, "?", ["?", "."]);
define_operator!(condition_end, ":", []);

// `=` `+=` `-=` `**=` `*=` `/=` `%=` `<<=` `>>=` `>>>=` `&=` `^=` `|=` `&&=` `||=` `??=` are not allowed

fn is_ident_char(ch: char) -> bool {
    ch == '_' || ch == '$' || ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch) || ('0'..='9').contains(&ch)
}

fn is_ident_start_char(ch: char) -> bool {
    ch == '_' || ch == '$' || ('a'..='z').contains(&ch) || ('A'..='Z').contains(&ch)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn ident() {
        case!("{{ $ }}", "{{$}}");
        case!("{{ $_ }}", "{{$_}}");
        case!("{{ a0 }}", "{{a0}}");
    }

    #[test]
    fn lit_str() {
        case!("{{ '", "", ParseErrorKind::MissingExpressionEnd, 0..2);
        case!(r#"{{ 'a\n\u0041\x4f\x4E' }}"#, "a\nAON");
        case!(r#"{{ 'a\n\u0' }}"#, "a\n 0", ParseErrorKind::IllegalEscapeSequence, 9..11);
        case!(r#"{{ "" }}"#, "");
    }

    #[test]
    fn number() {
        case!(r#"{{ 0 }}"#, r#"{{0}}"#);
        case!(r#"{{ 089 }}"#, r#"{{89}}"#);
        case!(r#"{{ 010 }}"#, r#"{{8}}"#);
        case!(r#"{{ 0x }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 5..5);
        case!(r#"{{ 0xaB }}"#, r#"{{171}}"#);
        case!(r#"{{ 0e }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 5..5);
        case!(r#"{{ 0e- }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 6..6);
        case!(r#"{{ 0e12 }}"#, r#"{{0}}"#);
        case!(r#"{{ 102 }}"#, r#"{{102}}"#);
        case!(r#"{{ 0.1 }}"#, r#"{{0.1}}"#);
        case!(r#"{{ .1 }}"#, r#"{{0.1}}"#);
        case!(r#"{{ 1. }}"#, r#"{{1}}"#);
        case!(r#"{{ 1.2e1 }}"#, r#"{{12}}"#);
        case!(r#"{{ 1.2e01 }}"#, r#"{{12}}"#);
        case!(r#"{{ 1.2e-1 }}"#, r#"{{0.12}}"#);
    }

    #[test]
    fn lit_obj() {
        case!(r#"{{{ a }}}"#, r#"{{{a}}}"#);
        case!(r#"{{ { a# } }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 6..6);
        case!(r#"{{ { a:# } }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 7..7);
        case!(r#"{{ { } }}"#, r#"{{{}}}"#);
        case!(r#"{{ {,} }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 4..4);
        case!(r#"{{ a: 1, a: 2 }}"#, r#"{{{a:1,a:2}}}"#, ParseErrorKind::DuplicatedName, 3..4);
        case!(r#"{{ a: 1, a }}"#, r#"{{{a:1,a}}}"#, ParseErrorKind::DuplicatedName, 3..4);
        case!(r#"{{ a: 1 }}"#, r#"{{{a:1}}}"#);
        case!(r#"{{ a: 2, }}"#, r#"{{{a:2}}}"#);
        case!(r#"{{ a: 2, b: 3 }}"#, r#"{{{a:2,b:3}}}"#);
        case!(r#"{{ a, }}"#, r#"{{{a}}}"#);
        case!(r#"{{ ...a, ...b }}"#, r#"{{{...a,...b}}}"#);
        case!(r#"{{ {...} }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 7..7);
    }

    #[test]
    fn lit_arr() {
        case!(r#"{{ [ a, ] }}"#, r#"{{[a]}}"#);
        case!(r#"{{ [ a# ] }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 6..6);
        case!(r#"{{ [ , ] }}"#, r#"{{[,]}}"#);
        case!(r#"{{ [ , , ] }}"#, r#"{{[,,]}}"#);
        case!(r#"{{ [ c, a + b ] }}"#, r#"{{[c,a+b]}}"#);
        case!(r#"{{ [ ...a, ] }}"#, r#"{{[...a]}}"#);
        case!(r#"{{ [ ...a, ...b ] }}"#, r#"{{[...a,...b]}}"#);
        case!(r#"{{ [...] }}"#, r#""#, ParseErrorKind::UnexpectedCharacter, 7..7);
    }

    #[test]
    fn paren() {
        case!(r#"{{ ( ) }}"#, r#"{{a+b}}"#, ParseErrorKind::UnexpectedCharacter, 5..5);
        case!(r#"{{ ( a }}"#, r#"{{a+b}}"#, ParseErrorKind::UnmatchedParenthesis, 7..7);
        case!(r#"{{ ( a + b ) }}"#, r#"{{a+b}}"#);
        case!(r#"{{ ( a + b ) * c }}"#, r#"{{(a+b)*c}}"#);
        case!(r#"{{ ( a + b ) < c }}"#, r#"{{a+b<c}}"#);
    }

    #[test]
    fn static_member() {
        case!("{{ a. }}", "", ParseErrorKind::InvalidIdentifier, 6..6);
        case!("{{ a.0 }}", "", ParseErrorKind::InvalidIdentifier, 5..5);
        case!("{{ a.$ }}", "{{a.$}}");
    }

    #[test]
    fn dynamic_member() {
        case!("{{ a[ ] }}", "", ParseErrorKind::InvalidIdentifier, 6..6);
        case!("{{ a[0 }}", "", ParseErrorKind::UnmatchedBracket, 7..7);
        case!("{{ a[a ? b : c] }}", "{{a[a?b:c]}}");
    }

    #[test]
    fn func_call() {
        case!("{{ a( ) }}", "{{a()}}");
        case!("{{ a(0 }}", "", ParseErrorKind::UnmatchedParenthesis, 7..7);
        case!("{{ a(0,)", "{{a(0)}}");
        case!("{{ a(0 , a ? b : c)", "{{a(0,a?b:c)");
    }

    #[test]
    fn reverse() {
        case!("{{ ! a.b }}", "{{!a.b}}");
        case!("{{ ! ! a }}", "{{!!a}}");
    }

    #[test]
    fn bit_reverse() {
        case!("{{ ~ a.b }}", "{{~a.b}}");
        case!("{{ ~ ~ a }}", "{{~~a}}");
    }

    #[test]
    fn positive() {
        case!("{{ + a.b }}", "{{ +a.b}}");
        case!("{{ + + a }}", "{{+ +a}}");
        case!("{{ ++ a }}", "", ParseErrorKind::UnexpectedCharacter, 3..3);
    }

    #[test]
    fn negative() {
        case!("{{ - a.b }}", "{{ -a.b}}");
        case!("{{ - - a }}", "{{- -a}}");
        case!("{{ -- a }}", "", ParseErrorKind::UnexpectedCharacter, 3..3);
    }

    #[test]
    fn type_of() {
        case!("{{ typeof$ a.b }}", "", ParseErrorKind::UnexpectedCharacter, 11..11);
        case!("{{ typeof a.b }}", "{{typeof a.b}}");
        case!("{{ typeof typeof a }}", "{{typeof typeof a}}");
    }

    #[test]
    fn void() {
        case!("{{ void$0 a.b }}", "", ParseErrorKind::UnexpectedCharacter, 10..10);
        case!("{{ void a.b }}", "{{void a.b}}");
        case!("{{ void void a }}", "{{void void a}}");
    }

    #[test]
    fn multiply() {
        case!("{{ a * }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a *= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ** b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a * !b }}", "{{a*!b}}");
        case!("{{ !a * b }}", "{{!a*b}}");
        case!("{{ a * b * c }}", "{{a*b*c}}");
    }

    #[test]
    fn divide() {
        case!("{{ a / }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a /= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a // b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a / !b }}", "{{a/!b}}");
    }

    #[test]
    fn remainer() {
        case!("{{ a % }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a %= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a % !b }}", "{{a%!b}}");
    }

    #[test]
    fn plus() {
        case!("{{ a + }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a += b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ++ }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a + b * c }}", "{{a+b*c}}");
    }

    #[test]
    fn minus() {
        case!("{{ a - }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a -= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a -- }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a - b * c }}", "{{a-b*c}}");
    }

    #[test]
    fn lt() {
        case!("{{ a < }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a << b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a < b + c }}", "{{a<b+c}}");
    }

    #[test]
    fn lte() {
        case!("{{ a <= }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a <= b + c }}", "{{a<=b+c}}");
    }

    #[test]
    fn gt() {
        case!("{{ a > }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a >> b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a > b + c }}", "{{a>b+c}}");
    }

    #[test]
    fn gte() {
        case!("{{ a >= }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a >= b + c }}", "{{a>=b+c}}");
    }

    #[test]
    fn instance_of() {
        case!("{{ instanceof }}", "{{instanceof}}");
        case!("{{ a instanceof }}", "", ParseErrorKind::UnexpectedCharacter, 16..16);
        case!("{{ a instanceof0 }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a instanceof b + c }}", "{{a instanceof b+c}}");
    }

    #[test]
    fn eq() {
        case!("{{ a == }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a == b < c }}", "{{a==b<c}}");
    }

    #[test]
    fn ne() {
        case!("{{ a != }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a != b < c }}", "{{a!=b<c}}");
    }

    #[test]
    fn eq_full() {
        case!("{{ a === }}", "", ParseErrorKind::UnexpectedCharacter, 9..9);
        case!("{{ a === b < c }}", "{{a===b<c}}");
    }

    #[test]
    fn ne_full() {
        case!("{{ a !== }}", "", ParseErrorKind::UnexpectedCharacter, 9..9);
        case!("{{ a !== b < c }}", "{{a!==b<c}}");
    }

    #[test]
    fn bit_and() {
        case!("{{ a & }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a &= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a & b == c }}", "{{a&b==c}}");
    }

    #[test]
    fn bit_xor() {
        case!("{{ a ^ }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a ^= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ^ b & c }}", "{{a^b&c}}");
    }

    #[test]
    fn bit_or() {
        case!("{{ a | }}", "", ParseErrorKind::UnexpectedCharacter, 7..7);
        case!("{{ a |= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a | b ^ c }}", "{{a|b^c}}");
    }

    #[test]
    fn logic_and() {
        case!("{{ a && }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a &&= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a && b | c }}", "{{a&&b|c}}");
    }

    #[test]
    fn logic_or() {
        case!("{{ a || }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a ||= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a || b && c }}", "{{a||b&&c}}");
    }

    #[test]
    fn nullish_coalescing() {
        case!("{{ a ?? }}", "", ParseErrorKind::UnexpectedCharacter, 8..8);
        case!("{{ a ??= b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ?? b || c }}", "{{a??b||c}}");
    }

    #[test]
    fn cond() {
        case!("{{ a ? b }}", "", ParseErrorKind::IncompleteConditionExpression, 9..9);
        case!("{{ a : b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ?. b }}", "", ParseErrorKind::UnexpectedCharacter, 5..5);
        case!("{{ a ? b : c }}", "{{a?b:c}}");
    }
}

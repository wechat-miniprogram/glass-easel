use std::fmt::{Result as FmtResult, Write as FmtWrite};

use super::stringifier::*;
use crate::{
    escape::gen_lit_str,
    parse::expr::{ArrayFieldKind, Expression, ObjectFieldKind},
};

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Ord)]
pub(crate) enum ExpressionLevel {
    Lit = 0,
    Member,
    Unary,
    Multiply,
    Plus,
    Shift,
    Comparison,
    Eq,
    BitAnd,
    BitXor,
    BitOr,
    LogicAnd,
    LogicOr,
    Cond,
}

impl ExpressionLevel {
    pub(crate) fn from_expression(expr: &Expression) -> Self {
        match expr {
            Expression::ScopeRef { .. } => ExpressionLevel::Lit,
            Expression::DataField { .. } => ExpressionLevel::Lit,
            Expression::ToStringWithoutUndefined { .. } => ExpressionLevel::Member,
            Expression::LitUndefined { .. } => ExpressionLevel::Lit,
            Expression::LitNull { .. } => ExpressionLevel::Lit,
            Expression::LitStr { .. } => ExpressionLevel::Lit,
            Expression::LitInt { .. } => ExpressionLevel::Lit,
            Expression::LitFloat { .. } => ExpressionLevel::Lit,
            Expression::LitBool { .. } => ExpressionLevel::Lit,
            Expression::LitObj { .. } => ExpressionLevel::Lit,
            Expression::LitArr { .. } => ExpressionLevel::Lit,
            Expression::StaticMember { .. } => ExpressionLevel::Member,
            Expression::DynamicMember { .. } => ExpressionLevel::Member,
            Expression::FuncCall { .. } => ExpressionLevel::Member,
            Expression::Reverse { .. } => ExpressionLevel::Unary,
            Expression::BitReverse { .. } => ExpressionLevel::Unary,
            Expression::Positive { .. } => ExpressionLevel::Unary,
            Expression::Negative { .. } => ExpressionLevel::Unary,
            Expression::TypeOf { .. } => ExpressionLevel::Unary,
            Expression::Void { .. } => ExpressionLevel::Unary,
            Expression::Multiply { .. } => ExpressionLevel::Multiply,
            Expression::Divide { .. } => ExpressionLevel::Multiply,
            Expression::Remainer { .. } => ExpressionLevel::Multiply,
            Expression::Plus { .. } => ExpressionLevel::Plus,
            Expression::Minus { .. } => ExpressionLevel::Plus,
            Expression::LeftShift { .. } => ExpressionLevel::Shift,
            Expression::RightShift { .. } => ExpressionLevel::Shift,
            Expression::UnsignedRightShift { .. } => ExpressionLevel::Shift,
            Expression::Lt { .. } => ExpressionLevel::Comparison,
            Expression::Gt { .. } => ExpressionLevel::Comparison,
            Expression::Lte { .. } => ExpressionLevel::Comparison,
            Expression::Gte { .. } => ExpressionLevel::Comparison,
            Expression::InstanceOf { .. } => ExpressionLevel::Comparison,
            Expression::Eq { .. } => ExpressionLevel::Eq,
            Expression::Ne { .. } => ExpressionLevel::Eq,
            Expression::EqFull { .. } => ExpressionLevel::Eq,
            Expression::NeFull { .. } => ExpressionLevel::Eq,
            Expression::BitAnd { .. } => ExpressionLevel::BitAnd,
            Expression::BitXor { .. } => ExpressionLevel::BitXor,
            Expression::BitOr { .. } => ExpressionLevel::BitOr,
            Expression::LogicAnd { .. } => ExpressionLevel::LogicAnd,
            Expression::LogicOr { .. } => ExpressionLevel::LogicOr,
            Expression::NullishCoalescing { .. } => ExpressionLevel::LogicOr,
            Expression::Cond { .. } => ExpressionLevel::Cond,
        }
    }
}

fn expression_strigify_write<W: FmtWrite>(
    expression: &Expression,
    stringifier: &mut StringifierLine<W>,
    accept_level: ExpressionLevel,
) -> FmtResult {
    let cur_level = ExpressionLevel::from_expression(expression);
    if cur_level > accept_level {
        stringifier.write_str_state("(", StringifierLineState::ParenStart)?;
        expression_strigify_write(expression, stringifier, ExpressionLevel::Cond)?;
        stringifier.write_str_state(")", StringifierLineState::ParenEnd)?;
        return Ok(());
    }
    match expression {
        Expression::ScopeRef { location, index } => {
            stringifier.write_scope_name(*index, location)?;
        }
        Expression::DataField { name, location } => {
            stringifier.write_token_state(
                name,
                Some(name),
                location,
                StringifierLineState::Normal,
            )?;
        }
        Expression::ToStringWithoutUndefined { .. } => {
            panic!("illegal expression");
        }

        Expression::LitUndefined { location } => {
            stringifier.write_token_state(
                "undefined",
                None,
                location,
                StringifierLineState::Normal,
            )?;
        }
        Expression::LitNull { location } => {
            stringifier.write_token_state("null", None, location, StringifierLineState::Normal)?;
        }
        Expression::LitStr { value, location } => {
            let quoted = gen_lit_str(&value);
            stringifier.write_token_state(
                &format!(r#"{}"#, quoted),
                None,
                &location,
                StringifierLineState::Normal,
            )?;
        }
        Expression::LitInt { value, location } => {
            let value = value.to_string();
            stringifier.write_token_state(&value, None, location, StringifierLineState::Normal)?;
        }
        Expression::LitFloat { value, location } => {
            let value = value.to_string();
            stringifier.write_token_state(&value, None, location, StringifierLineState::Normal)?;
        }
        Expression::LitBool { value, location } => {
            let value = if *value { "true" } else { "false" };
            stringifier.write_token_state(value, None, location, StringifierLineState::Normal)?;
        }
        Expression::LitObj {
            fields,
            brace_location,
        } => {
            stringifier.write_token_state(
                "{",
                None,
                &brace_location.0,
                StringifierLineState::BraceStart,
            )?;
            for (index, field) in fields.iter().enumerate() {
                if index > 0 {
                    stringifier.write_str_state(",", StringifierLineState::NoSpaceBefore)?;
                }
                match field {
                    ObjectFieldKind::Named {
                        name,
                        location,
                        colon_location,
                        value,
                    } => {
                        let is_shortcut = match value {
                            Expression::ScopeRef { index, .. } => {
                                stringifier.block().get_scope_name(*index) == name.as_str()
                            }
                            Expression::DataField { name: x, .. } => x == name,
                            _ => false,
                        };
                        stringifier.write_token_state(
                            name,
                            None,
                            location,
                            StringifierLineState::Normal,
                        )?;
                        if !is_shortcut {
                            stringifier.write_token_state(
                                ":",
                                None,
                                colon_location.as_ref().unwrap_or(location),
                                StringifierLineState::NoSpaceBefore,
                            )?;
                            expression_strigify_write(value, stringifier, ExpressionLevel::Cond)?;
                        }
                    }
                    ObjectFieldKind::Spread { location, value } => {
                        stringifier.write_token_state(
                            "...",
                            None,
                            location,
                            StringifierLineState::NoSpaceAfter,
                        )?;
                        expression_strigify_write(value, stringifier, ExpressionLevel::Cond)?;
                    }
                }
            }
            stringifier.write_token_state(
                "}",
                None,
                &brace_location.1,
                StringifierLineState::BraceEnd,
            )?;
        }
        Expression::LitArr {
            fields,
            bracket_location,
        } => {
            stringifier.write_token_state(
                "[",
                None,
                &bracket_location.0,
                StringifierLineState::NoSpaceAfter,
            )?;
            for (index, field) in fields.iter().enumerate() {
                if index > 0 {
                    stringifier.write_str_state(",", StringifierLineState::NoSpaceBefore)?;
                }
                match field {
                    ArrayFieldKind::Normal { value } => {
                        expression_strigify_write(value, stringifier, ExpressionLevel::Cond)?;
                    }
                    ArrayFieldKind::Spread { location, value } => {
                        stringifier.write_token_state(
                            "...",
                            None,
                            location,
                            StringifierLineState::NoSpaceAfter,
                        )?;
                        expression_strigify_write(value, stringifier, ExpressionLevel::Cond)?;
                    }
                    ArrayFieldKind::EmptySlot => {
                        if index == fields.len() - 1 {
                            stringifier
                                .write_str_state(",", StringifierLineState::NoSpaceBefore)?;
                        }
                    }
                }
            }
            stringifier.write_token_state(
                "]",
                None,
                &bracket_location.1,
                StringifierLineState::ParenEnd,
            )?;
        }

        Expression::StaticMember {
            obj,
            field_name,
            dot_location,
            field_location,
        } => {
            expression_strigify_write(obj, stringifier, ExpressionLevel::Member)?;
            stringifier.write_token_state(
                ".",
                None,
                dot_location,
                StringifierLineState::NoSpaceAround,
            )?;
            stringifier.write_token_state(
                &field_name,
                Some(&field_name),
                field_location,
                StringifierLineState::Normal,
            )?;
        }
        Expression::DynamicMember {
            obj,
            field_name,
            bracket_location,
        } => {
            expression_strigify_write(obj, stringifier, ExpressionLevel::Member)?;
            stringifier.write_token_state(
                "[",
                None,
                &bracket_location.0,
                StringifierLineState::ParenCall,
            )?;
            expression_strigify_write(&field_name, stringifier, ExpressionLevel::Cond)?;
            stringifier.write_token_state(
                "]",
                None,
                &bracket_location.1,
                StringifierLineState::ParenEnd,
            )?;
        }
        Expression::FuncCall {
            func,
            args,
            paren_location,
        } => {
            expression_strigify_write(func, stringifier, ExpressionLevel::Member)?;
            stringifier.write_token_state(
                "(",
                None,
                &paren_location.0,
                StringifierLineState::ParenCall,
            )?;
            for (index, arg) in args.iter().enumerate() {
                if index > 0 {
                    stringifier.write_str_state(",", StringifierLineState::NoSpaceBefore)?;
                }
                expression_strigify_write(&arg, stringifier, ExpressionLevel::Cond)?;
            }
            stringifier.write_token_state(
                ")",
                None,
                &paren_location.1,
                StringifierLineState::ParenEnd,
            )?;
        }

        Expression::Reverse { value, location } => {
            stringifier.write_token_state(
                "!",
                None,
                location,
                StringifierLineState::NoSpaceAfter,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::BitReverse { value, location } => {
            stringifier.write_token_state(
                "~",
                None,
                location,
                StringifierLineState::NoSpaceAfter,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::Positive { value, location } => {
            stringifier.write_token_state(
                " +",
                None,
                location,
                StringifierLineState::NoSpaceAround,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::Negative { value, location } => {
            stringifier.write_token_state(
                " -",
                None,
                location,
                StringifierLineState::NoSpaceAround,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::TypeOf { value, location } => {
            stringifier.write_token_state(
                " typeof ",
                None,
                location,
                StringifierLineState::NoSpaceAround,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::Void { value, location } => {
            stringifier.write_token_state(
                " void ",
                None,
                location,
                StringifierLineState::NoSpaceAround,
            )?;
            expression_strigify_write(&value, stringifier, ExpressionLevel::Unary)?;
        }

        Expression::Multiply {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Multiply)?;
            stringifier.write_token_state("*", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::Divide {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Multiply)?;
            stringifier.write_token_state("/", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Unary)?;
        }
        Expression::Remainer {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Multiply)?;
            stringifier.write_token_state("%", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Unary)?;
        }

        Expression::Plus {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Plus)?;
            stringifier.write_token_state("+", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Multiply)?;
        }
        Expression::Minus {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Plus)?;
            stringifier.write_token_state("-", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Multiply)?;
        }

        Expression::LeftShift {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Shift)?;
            stringifier.write_token_state("<<", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Plus)?;
        }
        Expression::RightShift {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Shift)?;
            stringifier.write_token_state(">>", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Plus)?;
        }
        Expression::UnsignedRightShift {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Shift)?;
            stringifier.write_token_state(">>>", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Plus)?;
        }

        Expression::Lt {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Comparison)?;
            stringifier.write_token_state("<", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Shift)?;
        }
        Expression::Lte {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Comparison)?;
            stringifier.write_token_state("<=", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Shift)?;
        }
        Expression::Gt {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Comparison)?;
            stringifier.write_token_state(">", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Shift)?;
        }
        Expression::Gte {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Comparison)?;
            stringifier.write_token_state(">=", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Shift)?;
        }
        Expression::InstanceOf {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Comparison)?;
            stringifier.write_token_state(
                " instanceof ",
                None,
                location,
                StringifierLineState::NoSpaceAround,
            )?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Shift)?;
        }

        Expression::Eq {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Eq)?;
            stringifier.write_token_state("==", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Comparison)?;
        }
        Expression::Ne {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Eq)?;
            stringifier.write_token_state("!=", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Comparison)?;
        }
        Expression::EqFull {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Eq)?;
            stringifier.write_token_state("===", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Comparison)?;
        }
        Expression::NeFull {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::Eq)?;
            stringifier.write_token_state("!==", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Comparison)?;
        }

        Expression::BitAnd {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::BitAnd)?;
            stringifier.write_token_state("&", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::Eq)?;
        }

        Expression::BitXor {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::BitXor)?;
            stringifier.write_token_state("^", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::BitAnd)?;
        }

        Expression::BitOr {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::BitOr)?;
            stringifier.write_token_state("|", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::BitXor)?;
        }

        Expression::LogicAnd {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::LogicAnd)?;
            stringifier.write_token_state("&&", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::BitOr)?;
        }

        Expression::LogicOr {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::LogicOr)?;
            stringifier.write_token_state("||", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::LogicAnd)?;
        }
        Expression::NullishCoalescing {
            left,
            right,
            location,
        } => {
            expression_strigify_write(&left, stringifier, ExpressionLevel::LogicOr)?;
            stringifier.write_token_state("??", None, location, StringifierLineState::Normal)?;
            expression_strigify_write(&right, stringifier, ExpressionLevel::LogicAnd)?;
        }

        Expression::Cond {
            cond,
            true_br,
            false_br,
            question_location,
            colon_location,
        } => {
            expression_strigify_write(&cond, stringifier, ExpressionLevel::LogicOr)?;
            stringifier.write_token_state(
                "?",
                None,
                question_location,
                StringifierLineState::Normal,
            )?;
            expression_strigify_write(&true_br, stringifier, ExpressionLevel::Cond)?;
            stringifier.write_token_state(
                ":",
                None,
                colon_location,
                StringifierLineState::Normal,
            )?;
            expression_strigify_write(&false_br, stringifier, ExpressionLevel::Cond)?;
        }
    }
    Ok(())
}

impl StringifyLine for Expression {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(
        &self,
        stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    ) -> FmtResult {
        expression_strigify_write(self, stringifier, ExpressionLevel::Cond)
    }
}

#[cfg(test)]
impl Stringify for Expression {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        stringifier.block(|stringifier| stringifier.line(self))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn case(src: &str) {
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", Some(src), Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (stringify_result, _sourcemap) = stringifier.finish();
        assert_eq!(stringify_result.as_str(), &format!("{}\n", src));
    }

    #[test]
    fn ident() {
        case("{{ foo }}");
    }

    #[test]
    fn lit_str() {
        case(r#"{{ 1 + "foo" + 1 }}"#);
    }

    #[test]
    fn lit_obj() {
        case(r#"{{ { a: 1, b: 2, ...c } }}"#);
    }

    #[test]
    fn lit_arr() {
        case(r#"{{ [a, b, ...c] }}"#);
    }

    #[test]
    fn paren() {
        case(r#"{{ a * (b + c) }}"#);
    }

    #[test]
    fn static_member() {
        case(r#"{{ a.b }}"#);
    }

    #[test]
    fn dynamic_member() {
        case(r#"{{ a[b] }}"#);
    }

    #[test]
    fn func_call() {
        case(r#"{{ a(b, c) }}"#);
    }

    #[test]
    fn reverse() {
        case(r#"{{ !a }}"#);
    }

    #[test]
    fn bit_reverse() {
        case(r#"{{ ~a }}"#);
    }

    #[test]
    fn positive() {
        case(r#"{{ +a }}"#);
    }

    #[test]
    fn negative() {
        case(r#"{{ -a }}"#);
    }

    #[test]
    fn type_of() {
        case(r#"{{ typeof a }}"#);
    }

    #[test]
    fn void() {
        case(r#"{{ void a }}"#);
    }

    #[test]
    fn multiply() {
        case(r#"{{ a * b / c % d }}"#);
    }

    #[test]
    fn plus() {
        case(r#"{{ a + b - c }}"#);
    }

    #[test]
    fn shift() {
        case(r#"{{ a << 1 }}"#);
        case(r#"{{ a >> 1 }}"#);
        case(r#"{{ a >>> 1 }}"#);
    }

    #[test]
    fn comparison() {
        case(r#"{{ a < b }}"#);
        case(r#"{{ a > b }}"#);
        case(r#"{{ a <= b }}"#);
        case(r#"{{ a >= b }}"#);
        case(r#"{{ a == b }}"#);
        case(r#"{{ a === b }}"#);
        case(r#"{{ a != b }}"#);
        case(r#"{{ a !== b }}"#);
    }

    #[test]
    fn and_or() {
        case(r#"{{ a && 1 }}"#);
        case(r#"{{ a || 1 }}"#);
        case(r#"{{ a & 1 }}"#);
        case(r#"{{ a | 1 }}"#);
        case(r#"{{ a ^ 1 }}"#);
    }

    #[test]
    fn instance_of() {
        case(r#"{{ a instanceof b }}"#);
    }

    #[test]
    fn nullish_coalescing() {
        case(r#"{{ a ?? b }}"#);
    }

    #[test]
    fn cond() {
        case(r#"{{ a ? b : c }}"#);
    }
}

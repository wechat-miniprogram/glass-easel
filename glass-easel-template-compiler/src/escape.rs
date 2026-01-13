//! Helpers for escaping

use compact_str::CompactString;
use regex::{Captures, Regex};
use std::borrow::Cow;

pub(crate) fn escape_html_body(s: &str) -> Cow<'_, str> {
    lazy_static! {
        static ref REGEX: Regex = Regex::new("[<\"&]").unwrap();
    }
    REGEX.replace_all(s, |caps: &Captures| match &caps[0] {
        "<" => "&lt;".to_owned(),
        "\"" => "&quot;".to_owned(),
        "&" => "&amp;".to_owned(),
        _ => unreachable!(),
    })
}

pub(crate) fn escape_html_quote(s: &str) -> Cow<'_, str> {
    lazy_static! {
        static ref REGEX: Regex = Regex::new("[\"&]").unwrap();
    }
    REGEX.replace_all(s, |caps: &Captures| match &caps[0] {
        "\"" => "&quot;".to_owned(),
        "&" => "&amp;".to_owned(),
        _ => unreachable!(),
    })
}

pub(crate) fn gen_lit_str(s: &str) -> String {
    gen_lit_str_with_quotes(s, false)
}

pub(crate) fn gen_lit_str_with_quotes(s: &str, use_single_quote: bool) -> String {
    fn conv_ch_count(ch: u8, quote_ch: u8) -> usize {
        match ch {
            b'\\' | b'\n' | b'\r' | b'\t' | b'\0' => 2,
            1..=31 => 4,
            x if x == quote_ch => 2,
            _ => 1,
        }
    }

    fn conv_ch(w: &mut String, ch: char, quote_ch: char) {
        match ch {
            '\\' => w.push_str("\\\\"),
            '\n' => w.push_str("\\n"),
            '\r' => w.push_str("\\r"),
            '\t' => w.push_str("\\t"),
            '\0' => w.push_str("\\0"),
            x if x as u32 <= 31u32 => {
                w.push_str(&format!("\\x{:02X}", ch as u8));
            }
            x if x == quote_ch => w.push_str(&format!("\\{}", x)),
            x => w.push(x),
        }
    }

    let quote_ch = if use_single_quote { '\'' } else { '"' };
    let cap = s
        .bytes()
        .map(|ch| conv_ch_count(ch, quote_ch as u8))
        .sum::<usize>()
        + 2;
    let mut ret = String::with_capacity(cap);
    ret.push(quote_ch);
    for ch in s.chars() {
        conv_ch(&mut ret, ch, quote_ch);
    }
    ret.push(quote_ch);
    ret
}

pub(crate) fn dash_to_camel(s: &str) -> CompactString {
    let mut camel_name = CompactString::new("");
    let mut next_upper = false;
    for c in s.chars() {
        if c == '-' {
            next_upper = true;
        } else if next_upper {
            next_upper = false;
            camel_name.push(c.to_ascii_uppercase());
        } else {
            camel_name.push(c);
        }
    }
    camel_name
}

pub(crate) fn camel_to_dash(s: &str) -> CompactString {
    let mut dash_name = CompactString::new("");
    for c in s.chars() {
        if c.is_ascii_uppercase() {
            dash_name.push('-');
            dash_name.push(c.to_ascii_lowercase());
        } else {
            dash_name.push(c);
        }
    }
    dash_name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gen_lit_str_double_quoted() {
        assert_eq!(gen_lit_str_with_quotes("abc", false), r#""abc""#);
        assert_eq!(gen_lit_str_with_quotes("上下左右", false), r#""上下左右""#);
        assert_eq!(gen_lit_str_with_quotes("\n\r\t\0", false), r#""\n\r\t\0""#);
        assert_eq!(gen_lit_str_with_quotes("\u{1}", false), r#""\x01""#);
        assert_eq!(gen_lit_str_with_quotes("\u{1F}", false), r#""\x1F""#);
        assert_eq!(gen_lit_str_with_quotes("'", false), r#""'""#);
        assert_eq!(gen_lit_str_with_quotes("\"", false), r#""\"""#);
        assert_eq!(gen_lit_str_with_quotes("\\n\n", false), r#""\\n\n""#);
    }

    #[test]
    fn gen_lit_str_single_quoted() {
        assert_eq!(gen_lit_str_with_quotes("abc", true), r#"'abc'"#);
        assert_eq!(gen_lit_str_with_quotes("'", true), r#"'\''"#);
        assert_eq!(gen_lit_str_with_quotes("\"", true), r#"'"'"#);
    }
}

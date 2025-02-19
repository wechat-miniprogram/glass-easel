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
    format!("{:?}", s)
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

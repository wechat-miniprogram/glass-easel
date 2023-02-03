//! Helpers for escaping

use regex::{Captures, Regex};
use std::borrow::Cow;

pub(crate) fn escape_html_text(s: &str) -> Cow<'_, str> {
    lazy_static! {
        static ref REGEX: Regex = Regex::new("[<>&]").unwrap();
    }
    REGEX.replace_all(s, |caps: &Captures| match &caps[0] {
        "<" => "&lt;".to_owned(),
        ">" => "&gt;".to_owned(),
        "\"" => "&quot;".to_owned(),
        "&" => "&amp;".to_owned(),
        _ => unreachable!(),
    })
}

pub(crate) fn gen_lit_str(s: &str) -> String {
    format!("{:?}", s)
}

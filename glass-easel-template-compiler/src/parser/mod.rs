use std::ops::Range;

mod tag;
mod expr;

pub(crate) trait TemplateStructure {
    fn position(&self) -> Range<Position>;
}

struct ParseState<'s> {
    s: &'s str,
    cur: u32,
    warnings: Vec<ParseError>,
    errors: Vec<ParseError>,
}

impl<'s> ParseState<'s> {
    fn new(s: impl AsRef<str>) -> Self {
        let s = if s.len() >= u32::MAX as usize {
            log::error!("Source code too long. Truncated to `u32::MAX - 1` .");
            &s[..u32::MAX]
        } else {
            s
        };
        Self {
            s: s.as_ref(),
            cur: 0,
            warnings: vec![],
            errors: vec![],
        }
    }

    fn add_warning(&mut self, message: impl ToString, location: Range<Position>) {
        self.warnings.push(ParseError { message, location })
    }

    fn add_error(&mut self, message: impl ToString, location: Range<Position>) {
        self.warnings.push(ParseError { message, location })
    }

    fn warnings(&self) -> impl Iterator<Item = &ParseError> {
        self.warnings.iter()
    }

    fn errors(&self) -> impl Iterator<Item = &ParseError> {
        self.errors.iter()
    }

    fn peek_chars(&self) -> impl 's + Iterator<Item = char> {
        self.s[self.cur as usize..].chars()
    }

    fn peek_with_whitespace(&self) -> Option<char> {
        self.peek_chars().next()
    }

    fn peek(&self) -> Option<char> {
        let mut i = self.peek_chars();
        loop {
            let next = i.next()?;
            if !char::is_whitespace(next) {
                return Some(next);
            }
        }
    }

    fn next_with_whitespace(&mut self) -> Option<&'s str> {
        let prev = self.cur;
        let mut cur = prev + 1;
        if cur > self.s.len() {
            return None;
        }
        loop {
            if self.s.is_char_boundary(cur as usize) {
                break;
            }
            cur += 1;
        }
        self.cur = cur;
        Some(&self.s[prev..cur])
    }

    fn skip_whitespace(&mut self) {
        let mut i = self.s[self.cur as usize..].char_indices();
        self.cur = loop {
            let Some((index, c)) = i.next() else {
                break self.s.len();
            };
            if !char::is_whitespace(c) {
                break index;
            }
        };
    }

    fn next(&mut self) -> Option<&'s str> {
        self.skip_whitespace();
        self.next_with_whitespace()
    }

    fn cur(&self) -> usize {
        self.cur as usize
    }

    fn position(&self) -> Position {
        
    }
}

pub(crate) fn parse<'s>(path: &str, source: &'s str) -> (tag::Template, ParseState<'s>) {
    let mut state = ParseState::new(source);
    let template = tag::Template::parse(path, &mut state);
    (template, state)
}

/// A location in source code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Position {
    utf8_index: u32,
    line: u32,
    utf16_col: u32,
}

impl Position {
    /// Get the UTF-8 byte offsets in the source code.
    pub fn utf8_index(&self) -> usize {
        self.utf8_index as usize
    }

    /// Get the line-column offsets (in UTF-16) in the source code.
    pub fn line_col_utf16<'s>(&self) -> (usize, usize) {
        (self.line as usize, self.utf16_col as usize)
    }
}

/// Template parsing error object.
pub struct ParseError {
    pub message: String,
    pub location: Range<Position>,
}

impl std::fmt::Debug for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "Template parsing error (at {}:{}:{}): {}",
            self.filename, self.start_pos.0, self.start_pos.1, self.message
        )
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for ParseError {}

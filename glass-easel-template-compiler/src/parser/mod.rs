use std::ops::Range;

use compact_str::CompactString;

mod tag;
mod expr;
mod binding_map;

pub(crate) trait TemplateStructure {
    fn location(&self) -> Range<Position>;

    fn location_start(&self) -> Position {
        self.location().start
    }

    fn location_end(&self) -> Position {
        self.location().end
    }
}

struct ParseState<'s> {
    path: &'s str,
    s: &'s str,
    cur: usize,
    line: u32,
    utf16_col: u32,
    scopes: Vec<(CompactString, Range<Position>)>,
    warnings: Vec<ParseError>,
    errors: Vec<ParseError>,
}

impl<'s> ParseState<'s> {
    fn new(path: &'s str, content: &'s str) -> Self {
        let s = content;
        let s = if s.len() >= u32::MAX as usize {
            log::error!("Source code too long. Truncated to `u32::MAX - 1` .");
            &s[..(u32::MAX as usize - 1)]
        } else {
            s
        };
        Self {
            path,
            s,
            cur: 0,
            line: 1,
            utf16_col: 0,
            scopes: vec![],
            warnings: vec![],
            errors: vec![],
        }
    }

    fn add_warning(&mut self, kind: ParseErrorKind, location: Range<Position>) {
        self.warnings.push(ParseError { path: self.path.to_string(), kind, location })
    }

    fn add_warning_at_current_position(&mut self, kind: ParseErrorKind) {
        let pos = self.position();
        self.add_warning(kind, pos..pos)
    }

    fn warnings(&self) -> impl Iterator<Item = &ParseError> {
        self.warnings.iter()
    }

    fn parse_with_scope<T>(&mut self, ident: CompactString, location: Range<Position>, f: impl FnOnce(&mut Self) -> T) -> T {
        self.scopes.push((ident, location));
        let ret = f(self);
        self.scopes.pop();
        ret
    }

    fn parse_with_no_scopes<T>(&mut self, f: impl FnOnce(&mut Self) -> T) -> T {
        let old_scopes = std::mem::replace(&mut self.scopes, vec![]);
        let ret = f(self);
        self.scopes = old_scopes;
        ret
    }

    fn try_parse<T>(&mut self, f: impl FnOnce(&mut Self) -> Option<T>) -> Option<T> {
        let prev = self.cur;
        let prev_line = self.line;
        let prev_utf16_col = self.utf16_col;
        let ret = f(self);
        if ret.is_none() {
            self.cur = prev;
            self.line = prev_line;
            self.utf16_col = prev_utf16_col;
        }
        ret
    }

    fn skip_until_after(&mut self, until: &str) -> Option<&'s str> {
        let (ret, skipped) = if let Some(index) = self.s[self.cur..].find(until) {
            let ret = &self.s[self.cur..index];
            let skipped = &self.s[self.cur..(index + until.len())];
            self.cur = index + until.len();
            (Some(ret), skipped)
        } else {
            let ret = &self.s[self.cur..];
            self.cur = self.s.len();
            (None, ret)
        };
        {
            // adjust position
            let line_wrap_count = skipped.as_bytes().into_iter().filter(|x| **x == b'\n').count();
            self.line += line_wrap_count as u32;
            if line_wrap_count > 0 {
                let last_line_start = skipped.rfind('\n').unwrap() + 1;
                self.utf16_col = skipped[last_line_start..].encode_utf16().count() as u32;
            } else {
                self.utf16_col += skipped.encode_utf16().count() as u32;
            }
        }
        ret
    }

    fn peek_chars(&self) -> impl 's + Iterator<Item = char> {
        self.s[self.cur as usize..].chars()
    }

    fn peek_n_with_whitespace<const N: usize>(&self) -> Option<[char; N]> {
        let mut ret: [char; N] = ['\x00'; N];
        let mut iter = self.peek_chars();
        for i in 0..N {
            ret[i] = iter.next()?;
        }
        Some(ret)
    }

    fn peek_n_without_whitespace<const N: usize>(&self) -> Option<[char; N]> {
        let mut ret: [char; N] = ['\x00'; N];
        let mut iter = self.peek_chars();
        let next = loop {
            let next = iter.next()?;
            if !char::is_whitespace(next) {
                break next;
            }
        };
        ret[0] = next;
        for i in 1..N {
            ret[i] = iter.next()?;
        }
        Some(ret)
    }

    fn peek_with_whitespace<const Index: usize>(&self) -> Option<char> {
        let mut iter = self.peek_chars();
        for _ in 0..Index {
            iter.next()?;
        }
        iter.next()
    }

    fn peek_without_whitespace<const Index: usize>(&self) -> Option<char> {
        let mut iter = self.peek_chars();
        let next = loop {
            let next = iter.next()?;
            if !char::is_whitespace(next) {
                break next;
            }
        };
        if Index == 0 {
            return Some(next);
        }
        for i in 1..Index {
            iter.next()?;
        }
        iter.next()
    }

    fn next_char_as_str(&mut self) -> &'s str {
        if self.cur < self.s.len() {
            let mut i = self.cur;
            loop {
                i += 1;
                if self.s.is_char_boundary(i) {
                    break;
                }
            }
            let ret = &self.s[self.cur..i];
            self.cur = i;
            if ret == "\n" {
                self.line += 1;
                self.utf16_col = 0;
            } else {
                self.utf16_col += ret.encode_utf16().count() as u32;
            }
            ret
        } else {
            ""
        }
    }

    fn next_with_whitespace(&mut self) -> Option<char> {
        let mut i = self.s[self.cur..].char_indices();
        let (_, ret) = i.next()?;
        self.cur = i.next().map(|(p, _)| p).unwrap_or(self.cur);
        if ret == '\n' {
            self.line += 1;
            self.utf16_col = 0;
        } else {
            self.utf16_col += ret.encode_utf16(&mut [0; 2]).len() as u32;
        }
        Some(ret)
    }

    fn next_without_whitespace(&mut self) -> Option<char> {
        self.skip_whitespace();
        self.next_with_whitespace()
    }

    fn skip_whitespace(&mut self) -> Option<Range<Position>> {
        let mut start_pos = None;
        let mut i = self.s[self.cur..].char_indices();
        self.cur = loop {
            let Some((index, c)) = i.next() else {
                break self.s.len();
            };
            if !char::is_whitespace(c) {
                break index;
            }
            if start_pos.is_none() {
                start_pos = Some(self.position());
            }
            if c == '\n' {
                self.line += 1;
                self.utf16_col = 0;
            } else {
                self.utf16_col += c.encode_utf16(&mut [0; 2]).len() as u32;
            }
        };
        start_pos.map(|x| x..self.position())
    }

    fn code_slice(&self, range: Range<usize>) -> &'s str {
        &self.s[range]
    }

    fn cur_index(&self) -> usize {
        self.cur as usize
    }

    fn position(&self) -> Position {
        Position {
            line: self.line,
            utf16_col: self.utf16_col,
        }
    }
}

pub(crate) fn parse<'s>(path: &str, source: &'s str) -> (tag::Template, ParseState<'s>) {
    let mut state = ParseState::new(path, source);
    let template = tag::Template::parse(&mut state);
    (template, state)
}

/// A location in source code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Position {
    pub line: u32,
    pub utf16_col: u32,
}

impl Position {
    /// Get the line-column offsets (in UTF-16) in the source code.
    pub fn line_col_utf16<'s>(&self) -> (usize, usize) {
        (self.line as usize, self.utf16_col as usize)
    }
}

/// Template parsing error object.
#[derive(Debug, Clone)]
pub struct ParseError {
    pub path: String,
    pub kind: ParseErrorKind,
    pub location: Range<Position>,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "template parsing error at {}:{}:{}-{}:{}: {}",
            self.path,
            self.location.start.line + 1,
            self.location.start.utf16_col + 1,
            self.location.end.line + 1,
            self.location.end.utf16_col + 1,
            self.kind,
        )
    }
}

impl std::error::Error for ParseError {}

#[derive(Clone)]
pub enum ParseErrorKind {
    IllegalCharacter = 0x10001,
    UnrecognizedTag,
    IllegalExpression,
    MissingExpressionEnd,
    IllegalEntity,
    IncompleteTag,
    MissingEndTag,
    IllegalTagNamePrefix,
    IllegalAttributePrefix,
    IllegalAttributeName,
    IllegalAttributeValue,
    InvalidAttribute,
    DuplicatedAttribute,
    DuplicatedName,
    UnexpectedWhitespace,
    MissingAttributeValue,
    DataBindingNotAllowed,
    InvalidIdentifier,
    ChildNodesNotAllowed,
    IllegalEscapeSequence,
}

impl ParseErrorKind {
    fn static_message(&self) -> &'static str {
        match self {
            Self::IllegalCharacter => "illegal character",
            Self::UnrecognizedTag => "unrecognized tag",
            Self::IllegalExpression => "illegal expression",
            Self::MissingExpressionEnd => "missing expression end",
            Self::IllegalEntity => "illegal entity",
            Self::IncompleteTag => "incomplete tag",
            Self::MissingEndTag => "missing end tag",
            Self::IllegalTagNamePrefix => "illegal tag name prefix",
            Self::IllegalAttributePrefix => "illegal attribute prefix",
            Self::IllegalAttributeName => "illegal attribute name",
            Self::IllegalAttributeValue => "illegal attribute value",
            Self::InvalidAttribute => "invalid attribute",
            Self::DuplicatedAttribute => "duplicated attribute",
            Self::DuplicatedName => "duplicated name",
            Self::UnexpectedWhitespace => "unexpected whitespace",
            Self::MissingAttributeValue => "missing attribute value",
            Self::DataBindingNotAllowed => "data bindings are not allowed for this attribute",
            Self::InvalidIdentifier => "not a valid identifier",
            Self::ChildNodesNotAllowed => "child nodes are not allowed for this element",
            Self::IllegalEscapeSequence => "illegal escape sequence",
        }
    }
}

impl std::fmt::Debug for ParseErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{:?}", self.static_message())
    }
}

impl std::fmt::Display for ParseErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.static_message())
    }
}

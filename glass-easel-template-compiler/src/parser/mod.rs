use std::ops::Range;

/// The source code.
pub struct SourceCode<'s> {
    s: &'s str,
}

impl<'s> SourceCode<'s> {
    /// A new `SourceCode` from string.
    pub fn new(s: impl AsRef<str>) -> Self {
        Self { s: s.as_ref() }
    }

    /// Do parsing.
    pub fn parse(self) -> Tmpl<'s> {
        // TODO
    }
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

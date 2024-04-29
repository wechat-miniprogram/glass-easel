use std::ops::Range;

/// A location in source code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
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

/// Parsing error object.
#[derive(Debug, Clone, PartialEq)]
pub struct ParseError {
    pub path: String,
    pub kind: ParseErrorKind,
    pub location: Range<Position>,
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "style sheet parsing error at {}:{}:{}-{}:{}: {}",
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

impl ParseError {
    /// The level of the error.
    pub fn level(&self) -> ParseErrorLevel {
        self.kind.level()
    }

    /// An error code.
    pub fn code(&self) -> u32 {
        self.kind.clone() as u32
    }

    /// Whether the error prevent a success compilation.
    pub fn prevent_success(&self) -> bool {
        self.level() >= ParseErrorLevel::Error
    }
}

#[derive(Clone, PartialEq, Eq)]
pub enum ParseErrorKind {
    UnexpectedCharacter = 0x10001,
    IllegalImportPosition,
}

impl ParseErrorKind {
    fn static_message(&self) -> &'static str {
        match self {
            Self::UnexpectedCharacter => "unexpected character",
            Self::IllegalImportPosition => "`@import` should be placed at the start of the stylesheet (according to CSS standard)",
        }
    }

    pub fn level(&self) -> ParseErrorLevel {
        match self {
            Self::UnexpectedCharacter => ParseErrorLevel::Fatal,
            Self::IllegalImportPosition => ParseErrorLevel::Note,
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

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ParseErrorLevel {
    /// Likely to be an mistake and should be noticed.
    ///
    /// The generator may generate code that contains this kind of mistakes.
    Note = 1,
    /// Should be a mistake but the compiler can guess a good way to generate proper code.
    Warn,
    /// An error that prevents a successful compilation, but can still continue to find more errors.
    Error,
    /// A very serious error that can cause continuous compiling issues, such as miss matched braces.
    Fatal,
}

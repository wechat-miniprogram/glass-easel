use std::ops::{Deref, DerefMut};

use cssparser::{BasicParseError, Token};

use super::error;

pub(crate) struct StepParser<'i, 't, 'a> {
    parser: &'a mut cssparser::Parser<'i, 't>,
}

impl<'i, 't, 'a> Deref for StepParser<'i, 't, 'a> {
    type Target = cssparser::Parser<'i, 't>;

    fn deref(&self) -> &Self::Target {
        self.parser
    }
}

impl<'i, 't, 'a> DerefMut for StepParser<'i, 't, 'a> {
    fn deref_mut(&mut self) -> &mut <Self as Deref>::Target {
        self.parser
    }
}

impl<'i, 't, 'a> StepParser<'i, 't, 'a> {
    pub(crate) fn wrap(parser: &'a mut cssparser::Parser<'i, 't>) -> Self {
        Self { parser }
    }

    pub(crate) fn position(&self) -> error::Position {
        let loc = self.parser.current_source_location();
        error::Position {
            line: loc.line,
            utf16_col: loc.column - 1,
        }
    }

    pub(crate) fn peek(&mut self) -> Result<StepToken<'i>, BasicParseError<'i>> {
        self.parser.skip_whitespace();
        self.peek_including_whitespace()
    }

    pub(crate) fn peek_including_whitespace(
        &mut self,
    ) -> Result<StepToken<'i>, BasicParseError<'i>> {
        let position = self.position();
        let state = self.parser.state();
        let ret = self.parser.next_including_whitespace().map(|x| x.clone());
        self.parser.reset(&state);
        ret.map(|token| StepToken { token, position })
    }

    pub(crate) fn next(&mut self) -> Result<StepToken<'i>, BasicParseError<'i>> {
        self.parser.skip_whitespace();
        self.next_including_whitespace()
    }

    pub(crate) fn next_including_whitespace(
        &mut self,
    ) -> Result<StepToken<'i>, BasicParseError<'i>> {
        let position = self.position();
        let token = self.parser.next_including_whitespace().map(|x| x.clone())?;
        Ok(StepToken { token, position })
    }

    pub(crate) fn try_parse<F, T, E>(&mut self, thing: F) -> Result<T, E>
    where
        F: FnOnce(&mut StepParser<'i, 't, '_>) -> Result<T, E>,
    {
        self.parser
            .try_parse(|parser| thing(&mut StepParser { parser }))
    }
}

#[derive(Debug, Clone)]
pub(crate) struct StepToken<'i> {
    pub(crate) token: Token<'i>,
    pub(crate) position: error::Position,
}

impl<'i> Deref for StepToken<'i> {
    type Target = cssparser::Token<'i>;

    fn deref(&self) -> &Self::Target {
        &self.token
    }
}

impl<'i> StepToken<'i> {
    pub(crate) fn wrap(token: Token<'i>, position: error::Position) -> Self {
        Self { token, position }
    }

    pub(crate) fn wrap_at(token: Token<'i>, other: &Self) -> Self {
        let position = other.position.clone();
        Self { token, position }
    }
}

use std::fmt::Write;

use cssparser::{TokenSerializationType, ToCss, Token};
use sourcemap::{SourceMap, SourceMapBuilder};

use crate::step::StepToken;

pub struct StyleSheetOutput {
    s: String,
    prev_ser_type: TokenSerializationType,
    source_map: SourceMapBuilder,
    source_id: u32,
    utf16_len: u32,
}

impl StyleSheetOutput {
    pub(crate) fn new(path: &str, source_css: &str) -> Self {
        let mut source_map = SourceMapBuilder::new(None);
        let source_id = source_map.add_source(path);
        source_map.set_source_contents(source_id, Some(source_css));
        Self {
            s: String::new(),
            prev_ser_type: TokenSerializationType::Nothing,
            source_id,
            source_map,
            utf16_len: 0,
        }
    }

    pub fn write(&self, mut w: impl std::io::Write) -> std::io::Result<()> {
        w.write_all(self.s.as_bytes())
    }

    pub fn write_str(&self, mut w: impl std::fmt::Write) -> std::fmt::Result {
        write!(w, "{}", self.s)
    }

    pub fn write_source_map(self, w: impl std::io::Write) -> Result<(), sourcemap::Error> {
        self.source_map.into_sourcemap().to_writer(w)
    }

    pub fn extract_source_map(self) -> SourceMap {
        self.source_map.into_sourcemap()
    }

    pub(crate) fn cur_utf8_len(&self) -> usize {
        self.s.len()
    }

    pub(crate) fn get_output_segment(&self, range: std::ops::Range<usize>) -> &str {
        &self.s[range]
    }

    pub(crate) fn append_raw(&mut self, s: &str) {
        self.prev_ser_type = TokenSerializationType::Nothing;
        let output_start_pos = self.s.len();
        self.s += s;
        self.utf16_len += str::encode_utf16(&self.s[output_start_pos..]).count() as u32;
    }

    pub(crate) fn append_token(&mut self, token: StepToken, src: Option<Token>) {
        let next_ser_type = token.serialization_type();
        if self
            .prev_ser_type
            .needs_separator_when_before(next_ser_type)
        {
            write!(&mut self.s, " ").unwrap();
            self.utf16_len += 1;
        }
        self.prev_ser_type = next_ser_type;
        let output_start_pos = self.s.len();
        token.to_css(&mut self.s).unwrap();
        let name = src.map(|x| {
            let s = x.to_css_string();
            self.source_map.add_name(&s)
        });
        self.source_map.add_raw(
            0,
            self.utf16_len,
            token.position.line,
            token.position.utf16_col,
            Some(self.source_id),
            name,
        );
        self.utf16_len += str::encode_utf16(&self.s[output_start_pos..]).count() as u32;
    }

    pub(crate) fn append_token_space_preserved(
        &mut self,
        token: StepToken,
        src: Option<Token>,
    ) {
        if let Token::WhiteSpace(_) = &*token {
            self.prev_ser_type = token.serialization_type();
            self.s.push(' ');
            self.utf16_len += 1;
        } else {
            self.append_token(token, src);
        }
    }
}

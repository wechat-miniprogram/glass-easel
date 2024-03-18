use std::{fmt::{Result as FmtResult, Write as FmtWrite}, ops::Range};

use sourcemap::SourceMapBuilder;

use crate::{escape::escape_html_quote, parse::{
    tag::{Ident, StrName}, Position, TemplateStructure
}};

mod tag;
mod expr;

pub struct Stringifier<'s, W: FmtWrite> {
    w: W,
    line: u32,
    utf16_col: u32,
    smb: SourceMapBuilder,
    source_path: &'s str,
}

impl<'s, W: FmtWrite> Stringifier<'s, W> {
    pub fn new(w: W, source_path: &'s str, source: &'s str) -> Self {
        let mut smb = SourceMapBuilder::new(Some(source_path));
        let source_id = smb.add_source(source_path);
        smb.set_source_contents(source_id, Some(source));
        Self {
            w,
            line: 0,
            utf16_col: 0,
            smb,
            source_path,
        }
    }

    pub fn finish(self) -> W {
        self.w
    }

    fn write_str(&mut self, s: &str) -> FmtResult {
        self.w.write_str(s)?;
        let line_wrap_count = s.as_bytes().into_iter().filter(|x| **x == b'\n').count();
        self.line += line_wrap_count as u32;
        if line_wrap_count > 0 {
            let last_line_start = s.rfind('\n').unwrap() + 1;
            self.utf16_col = s[last_line_start..].encode_utf16().count() as u32;
        } else {
            self.utf16_col += s.encode_utf16().count() as u32;
        }
        Ok(())
    }

    fn write_token(&mut self, dest_text: &str, source_text: &str, location: &Range<Position>) -> FmtResult {
        self.smb.add(self.line + 1, self.utf16_col, location.start.line + 1, location.start.utf16_col, Some(self.source_path), Some(source_text));
        self.write_str(dest_text)?;
        Ok(())
    }

    fn write_str_name_quoted(&mut self, n: &StrName) -> FmtResult {
        let quoted = escape_html_quote(&n.name);
        self.write_token(&format!(r#""{}""#, quoted), &n.name, &n.location())
    }

    fn write_ident(&mut self, n: &Ident) -> FmtResult {
        self.write_token(&n.name, &n.name, &n.location())
    }
}

pub trait Stringify {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult;
}

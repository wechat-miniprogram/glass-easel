use std::{
    fmt::{Result as FmtResult, Write as FmtWrite}, ops::Range
};

use compact_str::CompactString;
pub use sourcemap::SourceMap;
use sourcemap::SourceMapBuilder;

use crate::{
    escape::escape_html_quote,
    parse::{
        tag::{Ident, StrName},
        Position, TemplateStructure,
    },
};
use super::StringifyOptions;

pub struct Stringifier<'s, W: FmtWrite> {
    w: W,
    line: u32,
    utf16_col: u32,
    smb: Option<SourceMapBuilder>,
    source_path: &'s str,
    options: StringifyOptions,
}

impl<'s, W: FmtWrite> Stringifier<'s, W> {
    pub fn new(w: W, source_path: &'s str, source: &'s str, options: StringifyOptions) -> Self {
        let smb = if options.source_map {
            let mut smb = SourceMapBuilder::new(Some(source_path));
            let source_id = smb.add_source(source_path);
            smb.set_source_contents(source_id, Some(source));
            Some(smb)
        } else {
            None
        };
        Self {
            w,
            line: 0,
            utf16_col: 0,
            smb,
            source_path,
            options,
        }
    }

    pub fn finish(self) -> (W, Option<SourceMap>) {
        let sourcemap = self.smb.map(|x| x.into_sourcemap());
        (self.w, sourcemap)
    }

    pub fn run(&mut self, s: impl Stringify) -> FmtResult {
        s.stringify_write(self)
    }

    pub(super) fn block(&mut self, f: impl FnOnce(&mut StringifierBlock<'s, '_, W>) -> FmtResult) -> FmtResult {
        let mut b = StringifierBlock { top: self, indent_level: 0, scope_names: &mut vec![] };
        let ret = f(&mut b);
        ret
    }

    #[inline(always)]
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
}

pub struct StringifierBlock<'s, 't, W: FmtWrite> {
    top: &'t mut Stringifier<'s, W>,
    indent_level: u32,
    scope_names: &'t mut Vec<CompactString>,
}

impl<'s, 't, W: FmtWrite> StringifierBlock<'s, 't, W> {
    pub(super) fn current_position(&self) -> Position {
        Position { line: self.top.line, utf16_col: self.top.utf16_col }
    }

    pub(super) fn minimize(&self) -> bool {
        self.top.options.minimize
    }

    pub(super) fn add_scope(&mut self, name: &CompactString) -> &CompactString {
        let i = self.scope_names.len();
        if self.top.options.mangling {
            self.scope_names.push(format!("_${}", i).into());
        } else {
            self.scope_names.push(name.clone());
        }
        &self.scope_names[i]
    }

    pub(super) fn get_scope_name(&mut self, index: usize) -> &str {
        self.scope_names
            .get(index)
            .map(|x| x.as_str())
            .unwrap_or("__INVALID_SCOPE_NAME__")
    }

    pub(super) fn new_scope_space(&mut self, f: impl FnOnce(&mut StringifierBlock<'s, '_, W>) -> FmtResult) -> FmtResult {
        let scope_names_len = self.scope_names.len();
        let ret = {
            let mut b = StringifierBlock {
                top: self.top,
                indent_level: self.indent_level,
                scope_names: self.scope_names,
            };
            f(&mut b)
        };
        self.scope_names.truncate(scope_names_len);
        ret
    }

    pub(super) fn sub_block(&mut self, t: &impl StringifyBlock) -> FmtResult {
        let mut b = StringifierBlock {
            top: self.top,
            indent_level: self.indent_level + 1,
            scope_names: self.scope_names,
        };
        t.stringify_write(&mut b)
    }

    fn write_indent(&mut self) -> FmtResult {
        if !self.top.options.minimize {
            for _ in 0..self.indent_level {
                if self.top.options.use_tab_character {
                    self.top.write_str("\t")?;
                } else {
                    for _ in 0..self.top.options.tab_size {
                        self.top.write_str(" ")?;
                    }
                }
            }
        }
        Ok(())
    }

    pub(super) fn write_line(&mut self, f: impl FnOnce(&mut StringifierLine<'s, 't, '_, W>) -> FmtResult) -> FmtResult {
        self.write_indent()?;
        {
            let mut b = StringifierLine {
                block: self,
                state: StringifierLineState::LineStart,
            };
            f(&mut b)?;
        }
        if !self.top.options.minimize {
            self.top.write_str("\n")?;
        }
        Ok(())
    }

    pub(super) fn empty_seperation_line(&mut self) -> FmtResult {
        if self.top.line == 0 {
            return Ok(())
        }
        if !self.top.options.minimize {
            self.top.write_str("\n")?;
        }
        Ok(())
    }

    pub(super) fn line(&mut self, t: &impl StringifyLine) -> FmtResult {
        self.write_line(|s| {
            t.stringify_write(s)
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StringifierLineState {
    Normal,
    LineStart,
}

pub struct StringifierLine<'s, 't, 'u, W: FmtWrite> {
    block: &'u mut StringifierBlock<'s, 't, W>,
    state: StringifierLineState,
}

impl<'s, 't, 'u, W: FmtWrite> StringifierLine<'s, 't, 'u, W> {
    pub(super) fn block(&mut self) -> &mut StringifierBlock<'s, 't, W> {
        &mut self.block
    }

    pub(super) fn minimize(&self) -> bool {
        self.block.minimize()
    }

    pub(super) fn write_optional_space(&mut self) -> FmtResult {
        if !self.minimize() && self.state != StringifierLineState::LineStart {
            self.write_str(" ")?;
        }
        Ok(())
    }

    pub(super) fn write_str(&mut self, s: &str) -> FmtResult {
        self.state = StringifierLineState::Normal;
        self.block.top.write_str(s)
    }

    pub(super) fn add_scope(&mut self, name: &CompactString) -> &CompactString {
        self.block.add_scope(name)
    }

    pub(super) fn write_scope_name(&mut self, index: usize, location: &Range<Position>) -> FmtResult {
        let name = self.block.get_scope_name(index).to_string();
        self.write_token(&name, Some(&name), location)
    }

    pub(super) fn write_token(
        &mut self,
        dest_text: &str,
        source_text: Option<&str>,
        location: &Range<Position>,
    ) -> FmtResult {
        let top = &mut self.block.top;
        if let Some(smb) = top.smb.as_mut() {
            smb.add(
                top.line,
                top.utf16_col,
                location.start.line,
                location.start.utf16_col,
                Some(top.source_path),
                source_text,
            );
        }
        self.write_str(dest_text)?;
        Ok(())
    }

    pub(super) fn write_str_name_quoted(&mut self, n: &StrName) -> FmtResult {
        let quoted = escape_html_quote(&n.name);
        self.write_str("\"")?;
        self.write_token(&quoted, Some(&n.name), &n.location())?;
        self.write_str("\"")?;
        Ok(())
    }

    pub(super) fn write_ident(&mut self, n: &Ident, need_name: bool) -> FmtResult {
        self.write_token(&n.name, need_name.then_some(&n.name), &n.location())
    }

    pub(super) fn inline(&mut self, t: &impl StringifyLine) -> FmtResult {
        t.stringify_write(self)
    }

    pub(super) fn list(&mut self, t: &[impl StringifyItem]) -> FmtResult {
        let write_lines = if !self.block.top.options.minimize {
            let mut col = self.block.top.utf16_col;
            let col_max = self.block.top.options.line_width_limit;
            for item in t {
                if let Some(c) = item.count_utf16_col(self.block.top) {
                    col += 1 + c;
                    if col > col_max {
                        break;
                    }
                } else {
                    col = col_max + 1;
                    break;
                }
            }
            col > col_max
        } else {
            false
        };
        if write_lines {
            struct List<'a, T: StringifyItem> {
                items: &'a [T],
            }
            impl<'a, T: StringifyItem> StringifyBlock for List<'a, T> {
                fn stringify_write<'s, 't, W: FmtWrite>(&self, stringifier: &mut StringifierBlock<'s, 't, W>) -> FmtResult {
                    for item in self.items {
                        stringifier.line(item)?;
                    }
                    Ok(())
                }
            }
            self.sub_block(&List { items: t })?;
        } else {
            for item in t {
                self.write_str(" ")?;
                self.inline(item)?;
            }
        }
        Ok(())
    }

    pub(super) fn sub_block(&mut self, t: &impl StringifyBlock) -> FmtResult {
        if !self.block.top.options.minimize {
            self.write_str("\n")?;
        }
        self.block.sub_block(t)?;
        self.block.write_indent()?;
        self.state = StringifierLineState::LineStart;
        Ok(())
    }
}

pub trait Stringify {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult;
}

pub trait StringifyBlock {
    fn stringify_write<'s, 't, W: FmtWrite>(&self, stringifier: &mut StringifierBlock<'s, 't, W>) -> FmtResult;
}

pub trait StringifyLine {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(&self, stringifier: &mut StringifierLine<'s, 't, 'u, W>) -> FmtResult;
}

pub trait StringifyItem: StringifyLine + Sized {
    fn count_utf16_col<'s, W: FmtWrite>(&self, stringifier: &Stringifier<'s, W>) -> Option<u32> {
        struct FmtWriteCounter {
            count: u32,
        }
        impl FmtWrite for FmtWriteCounter {
            fn write_str(&mut self, s: &str) -> FmtResult {
                self.count += s.len() as u32;
                Ok(())
            }
        }
        let mut top = Stringifier {
            w: FmtWriteCounter { count: 0 },
            line: 0,
            utf16_col: 0,
            smb: None,
            source_path: stringifier.source_path,
            options: stringifier.options,
        };
        top.block(|block| {
            block.write_line(|stringifier| {
                stringifier.inline(self)
            })
        }).ok()?;
        Some(top.w.count)
    }
}

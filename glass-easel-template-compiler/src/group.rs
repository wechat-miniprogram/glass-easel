//! The template group for cross references

use std::collections::HashMap;
use std::fmt;
use std::fmt::Write;
use std::ops::Range;
use std::str::FromStr as _;

use wasm_bindgen::prelude::*;

use crate::escape::gen_lit_str;
use crate::parse::{ParseError, Position, Template};
use crate::proc_gen::{JsFunctionScopeWriter, JsTopScopeWriter};
use crate::stringify::Stringify;

// PRESERVED one-letter vars
// A: the binding map object
// B: the `DefineIfGroup` function
// C: true if in create process
// D: the global script runtime `define` / the data value
// E: the `DefineElement` function / the `elementUpdated` function
// F: the `DefineForLoop` function
// G: the whole group list
// H: the current group
// I: the current imported group
// J: the `DefinePureVirtualNode` function
// K: true if the whole data is changed
// L: = R.c
// M: = R.m
// N: the `Node` to operate (may be undefined)
// O: = R.r
// P (preserved for runtime)
// Q (extra runtime helpers)
// R: the global script module / the `ProcGenWrapper` object
// S: the `DefineSlot` function / the imported group cache
// T: the `DefineTextNode` function / the `updateText` function
// U: the update path tree
// V: the current slot values
// W: the update path trees of current slot values
// X (preserved for runtime)
// Y (preserved for runtime)
// Z (preserved for runtime)

// Q extra runtime helper list
// A: filter binding function in change properties bindings
// B: filter binding function in event bindings

const RUNTIME_ITEMS: [(&'static str, &'static str); 4] = [
    ("X", "function(a){return a==null?Object.create(null):a}"),
    ("Y", "function(a){return a==null?'':String(a)}"),
    (
        "Z",
        "function(a,b){if(a===true)return true;if(a)return a[b]}",
    ),
    ("P", "function(a){return typeof a==='function'?a:()=>{}}"),
];

const EXTRA_RUNTIME_ITEMS: [(&'static str, &'static str); 2] = [
    (
        "a",
        "function(a){for(var i=0;i<a.length;i++)if(a[i])return a}",
    ),
    (
        "b",
        "function(b){var a=Object.values(b);for(var i=0;i<a.length;i++)if(a[i])return a}",
    ),
];

const WXS_RUNTIME_ITEMS: [(&'static str, &'static str); 2] = [
    ("A", "function(a){return a}"),
    ("B", "function(a){return a}"),
    // "C" is preserved
];

const WXS_RUNTIME: &'static str = r#"
var D = (() => {
    var modules = Object.create(null);
    var load = (filename) => {
        var module = modules[filename];
        if (!module) throw new Error('no such WXS module: ' + filename);
        if (!module.loaded) {
            module.loaded = true;
            var require = (rel) => {
                var slices;
                if (rel[0] === '/') {
                    slices = rel.split('/');
                } else {
                    slices = filename.split('/').slice(0, -1).concat(rel.split('/'));
                }
                var normalized = [];
                slices.forEach((slice) => {
                    if (slice === '' || slice === '.') return;
                    if (slice === '..') {
                        normalized.pop();
                    } else {
                        normalized.push(slice);
                    }
                })
                return load(normalized.join('/'));
            };
            module.loader.call(null, require, module.exports, module);
        }
        return module.exports;
    };
    return (filename, func) => {
        modules[filename] = { exports: {}, loader: func, loaded: false };
        return () => load(filename);
    };
})()
"#;

fn runtime_fns<W: std::fmt::Write>(
    w: &mut JsFunctionScopeWriter<W>,
    need_wxs_runtime: bool,
) -> Result<(), TmplError> {
    for (k, v) in RUNTIME_ITEMS.iter() {
        w.expr_stmt(|w| {
            write!(w, "var {}={}", k, v)?;
            Ok(())
        })?;
    }
    w.expr_stmt(|w| {
        write!(w, "var Q={{")?;
        for (i, (k, v)) in EXTRA_RUNTIME_ITEMS.iter().enumerate() {
            if i > 0 {
                write!(w, ",")?;
            }
            write!(w, "{}:{}", k, v)?;
        }
        if need_wxs_runtime {
            for (k, v) in WXS_RUNTIME_ITEMS.iter() {
                write!(w, ",{}:{}", k, v)?;
            }
        }
        write!(w, "}}")?;
        Ok(())
    })?;
    if need_wxs_runtime {
        w.expr_stmt(|w| {
            write!(w, "{}", WXS_RUNTIME)?;
            Ok(())
        })?;
    }
    Ok(())
}

fn runtime_var_list() -> Vec<&'static str> {
    let mut ret: Vec<_> = RUNTIME_ITEMS.iter().map(|(k, _)| *k).collect();
    ret.push("Q");
    ret
}

/// A general template error.
pub struct TmplError {
    pub message: String,
}

impl fmt::Debug for TmplError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Template error: {}", self.message)
    }
}

impl fmt::Display for TmplError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl From<fmt::Error> for TmplError {
    fn from(e: fmt::Error) -> Self {
        Self {
            message: e.to_string(),
        }
    }
}

impl std::error::Error for TmplError {}

/// A template group in which the templates can ref each other.
#[derive(Debug)]
pub struct TmplGroup {
    trees: HashMap<String, Template>,
    scripts: HashMap<String, String>,
    has_scripts: bool,
    extra_runtime_string: String,
    dev_mode: bool,
}

impl TmplGroup {
    /// Create a new template group.
    pub fn new() -> Self {
        Self {
            trees: HashMap::new(),
            scripts: HashMap::new(),
            has_scripts: false,
            extra_runtime_string: String::new(),
            dev_mode: false,
        }
    }

    /// Create a new template group in dev mode.
    pub fn new_dev() -> Self {
        let mut this = Self::new();
        this.dev_mode = true;
        this
    }

    /// Get the dev mode.
    pub fn dev(&self) -> bool {
        self.dev_mode
    }

    /// import another group.
    pub fn import_group(&mut self, group: &TmplGroup) {
        self.trees.extend(group.trees.clone());
        self.scripts.extend(group.scripts.clone());
        self.has_scripts = self.has_scripts || group.has_scripts;
        self.extra_runtime_string
            .push_str(&group.extra_runtime_string);
    }

    /// Add a ref of a parsed tree in the group.
    pub fn get_tree(&self, path: &str) -> Result<&Template, TmplError> {
        match self.trees.get(path) {
            Some(x) => Ok(x),
            None => Err(TmplError {
                message: format!(r#"no template "{}" found"#, path),
            }),
        }
    }

    /// Get a mutable ref of a parsed tree in the group.
    pub fn get_tree_mut(&mut self, path: &str) -> Result<&mut Template, TmplError> {
        match self.trees.get_mut(path) {
            Some(x) => Ok(x),
            None => Err(TmplError {
                message: format!(r#"no template "{}" found"#, path),
            }),
        }
    }

    /// Add a template into the group.
    pub fn add_tmpl(&mut self, path: &str, tmpl_str: &str) -> Vec<ParseError> {
        let (template, mut parse_state) = crate::parse::parse(path, tmpl_str);
        if template.inline_script_module_names().next().is_some() {
            self.has_scripts = true;
        }
        let ret = parse_state.take_warnings();
        self.trees.insert(template.path.clone(), template);
        ret
    }

    /// Remove a template from the group.
    ///
    /// This simply removes a template path.
    /// It is useful when doing hot-update debugging,
    /// but not suitable for final builds since it does not do cleanups.
    /// Returns true when a template is actually removed.
    pub fn remove_tmpl(&mut self, path: &str) -> bool {
        self.trees.remove(path).is_some()
    }

    /// Regenerate a template content string of the specified template.
    pub fn stringify_tmpl(&self, path: &str) -> Option<String> {
        let template = self.trees.get(path)?;
        let options = crate::stringify::StringifyOptions {
            minimize: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), path, None, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (stringify_result, _sourcemap) = stringifier.finish();
        Some(stringify_result)
    }

    /// Get a script segment in the group.
    pub fn get_script(&mut self, path: &str) -> Result<&str, TmplError> {
        match self.scripts.get(path) {
            Some(x) => Ok(x.as_str()),
            None => Err(TmplError {
                message: format!(r#"no script "{}" found"#, path),
            }),
        }
    }

    /// Add a script segment into the group.
    ///
    /// The `content` must be valid JavaScript file content.
    /// `require` and `exports` can be visited in this JavaScript segment, similar to Node.js.
    pub fn add_script(&mut self, path: &str, content: &str) {
        self.scripts.insert(path.to_string(), content.to_string());
        self.has_scripts = true;
    }

    /// Remove a script segment from the group.
    ///
    /// This simply removes a script path.
    /// It is useful when doing hot-update debugging,
    /// but not suitable for final builds since it does not do cleanups.
    /// Returns true when a script is actually removed.
    pub fn remove_script(&mut self, path: &str) -> bool {
        self.scripts.remove(path).is_some()
    }

    /// Set extra runtime JavaScript code as a string.
    ///
    /// The `content` must be valid JavaScript statements, ended by semicolon.
    pub fn set_extra_runtime_script(&mut self, content: &str) {
        self.extra_runtime_string = content.to_string();
    }

    /// Output js runtime environment js code string.
    pub fn get_runtime_string(&self) -> String {
        let mut w = JsTopScopeWriter::new(String::new());
        w.function_scope(|w| {
            runtime_fns(w, self.has_scripts)?;
            Ok(())
        })
        .unwrap();
        w.finish() + self.extra_runtime_string.as_str()
    }

    /// Output js runtime environment js var name list.
    pub fn get_runtime_var_list() -> Vec<&'static str> {
        runtime_var_list()
    }

    /// Get direct dependency template files.
    pub fn direct_dependencies<'a>(
        &'a self,
        path: &str,
    ) -> Result<impl Iterator<Item = String> + 'a, TmplError> {
        Ok(self.get_tree(path)?.direct_dependencies())
    }

    /// Get dependency script files.
    pub fn script_dependencies<'a>(
        &'a self,
        path: &str,
    ) -> Result<impl Iterator<Item = String> + 'a, TmplError> {
        Ok(self.get_tree(path)?.script_dependencies())
    }

    /// Get inline script module names.
    pub fn inline_script_module_names<'a>(
        &'a self,
        path: &str,
    ) -> Result<impl Iterator<Item = &'a str>, TmplError> {
        Ok(self.get_tree(path)?.inline_script_module_names())
    }

    /// Get the start line of the inline script.
    pub fn inline_script_start_line(
        &self,
        path: &str,
        module_name: &str,
    ) -> Result<u32, TmplError> {
        match self.get_tree(path)?.inline_script_start_line(module_name) {
            Some(x) => Ok(x),
            None => Err(TmplError {
                message: format!(r#"no inline script "{}" found in "{}""#, path, module_name),
            }),
        }
    }

    /// Get inline script content.
    pub fn inline_script_content(&self, path: &str, module_name: &str) -> Result<&str, TmplError> {
        match self.get_tree(path)?.inline_script_content(module_name) {
            Some(x) => Ok(x),
            None => Err(TmplError {
                message: format!(r#"no inline script "{}" found in "{}""#, path, module_name),
            }),
        }
    }

    /// Set inline script content.
    pub fn set_inline_script_content(
        &mut self,
        path: &str,
        module_name: &str,
        new_content: &str,
    ) -> Result<(), TmplError> {
        Ok(self
            .get_tree_mut(path)?
            .set_inline_script_content(module_name, new_content))
    }

    /// Convert to WXML GenObject js string.
    pub fn get_tmpl_gen_object(&self, path: &str) -> Result<String, TmplError> {
        let tree = self.get_tree(path)?;
        let mut w = JsTopScopeWriter::new(String::new());
        w.expr_scope(|w| {
            tree.to_proc_gen(w, self)?;
            Ok(())
        })?;
        Ok(w.finish())
    }

    fn write_group_global_content(
        &self,
        w: &mut JsFunctionScopeWriter<String>,
    ) -> Result<(), TmplError> {
        runtime_fns(w, self.has_scripts)?;
        if self.extra_runtime_string.len() > 0 {
            w.custom_stmt_str(&self.extra_runtime_string)?;
        }
        self.write_all_scripts(w)?;
        Ok(())
    }

    fn write_all_scripts(&self, w: &mut JsFunctionScopeWriter<String>) -> Result<(), TmplError> {
        if self.scripts.len() > 0 {
            for (p, script) in self.scripts.iter() {
                w.expr_stmt(|w| {
                    write!(
                        w,
                        r#"R[{path}]=D({path},(require,exports,module)=>{{{}}})"#,
                        script,
                        path = gen_lit_str(p)
                    )?;
                    Ok(())
                })?;
            }
        }
        Ok(())
    }

    /// Convert all to WXML GenObject js string.
    pub fn get_tmpl_gen_object_groups(&self) -> Result<String, TmplError> {
        let mut w = JsTopScopeWriter::new(String::new());
        w.expr_scope(|w| {
            w.paren(|w| {
                w.function(|w| {
                    w.expr_stmt(|w| {
                        write!(w, "var G={{}}")?;
                        Ok(())
                    })?;
                    w.expr_stmt(|w| {
                        write!(w, "var R={{}}")?;
                        Ok(())
                    })?;
                    self.write_group_global_content(w)?;
                    for (path, tree) in self.trees.iter() {
                        w.expr_stmt(|w| {
                            write!(w, r#"G[{}]="#, gen_lit_str(path))?;
                            tree.to_proc_gen(w, self)?;
                            Ok(())
                        })?;
                    }
                    w.expr_stmt(|w| {
                        write!(w, "return G")?;
                        Ok(())
                    })?;
                    Ok(())
                })
            })?;
            w.paren(|_| Ok(()))?;
            Ok(())
        })?;
        Ok(w.finish())
    }

    /// Convert all to WXML GenObject js string, with wx environment support.
    pub fn get_wx_gen_object_groups(&self) -> Result<String, TmplError> {
        let mut w = JsTopScopeWriter::new(String::new());
        w.expr_scope(|w| {
            w.paren(|w| {
                w.function(|w| {
                    w.expr_stmt(|w| {
                        write!(w, "var G={{}}")?;
                        Ok(())
                    })?;
                    w.expr_stmt(|w| {
                        write!(w, "var R={{}}")?;
                        Ok(())
                    })?;
                    self.write_group_global_content(w)?;
                    for (path, tree) in self.trees.iter() {
                        w.expr_stmt(|w| {
                            write!(w, r#"__wxCodeSpace__.addCompiledTemplate({path},{{groupList:G,content:G[{path}]="#, path = gen_lit_str(path))?;
                            tree.to_proc_gen(w, self)?;
                            write!(w, "}})")?;
                            Ok(())
                        })?;
                    }
                    Ok(())
                })
            })?;
            w.paren(|_| Ok(()))?;
            Ok(())
        })?;
        Ok(w.finish())
    }

    pub fn export_globals(&self) -> Result<String, TmplError> {
        let mut w = JsTopScopeWriter::new(String::new());
        w.function_scope(|w| {
            runtime_fns(w, self.has_scripts)?;
            if self.extra_runtime_string.len() > 0 {
                w.custom_stmt_str(&self.extra_runtime_string)?;
            }
            Ok(())
        })?;
        Ok(w.finish())
    }

    pub fn export_all_scripts(&self) -> Result<String, TmplError> {
        let mut w = JsTopScopeWriter::new(String::new());
        w.function_scope(|w| {
            self.write_all_scripts(w)?;
            Ok(())
        })?;
        Ok(w.finish())
    }

    /// Get a string that used to check TypeScript problems.
    pub fn get_tmpl_converted_expr(
        &self,
        path: &str,
        ts_env: &str,
    ) -> Result<TmplConvertedExpr, TmplError> {
        let tree = self.get_tree(path)?;
        let env = crate::stringify::typescript::tmpl_converted_expr_runtime_string();
        let (code, source_map) =
            crate::stringify::typescript::generate_tmpl_converted_expr(tree, ts_env, env);
        Ok(TmplConvertedExpr { code, source_map })
    }

    /// Returns the number of templates in the group.
    pub fn len(&self) -> usize {
        self.trees.len()
    }

    /// Check if the group contains certain template.
    pub fn contains_template(&self, path: &str) -> bool {
        self.trees.contains_key(path)
    }

    /// List all available templates.
    pub fn list_template_trees(&self) -> impl Iterator<Item = (&str, &Template)> {
        self.trees.iter().map(|(name, tmpl)| (name.as_str(), tmpl))
    }
}

/// A string for TypeScript type checks with metadata.
///
/// This is the result of `get_tmpl_converted_expr`.
#[wasm_bindgen]
pub struct TmplConvertedExpr {
    code: String,
    source_map: sourcemap::SourceMap,
}

impl TmplConvertedExpr {
    /// Get the result TypeScript code as string.
    pub fn code(&self) -> &str {
        &self.code
    }

    /// Get the source code location for given TypeScript code location.
    pub fn get_source_location(&self, loc: Range<Position>) -> Option<Range<Position>> {
        let start = self
            .source_map
            .lookup_token(loc.start.line, loc.start.utf16_col)?;
        let (line, utf16_col) = start.get_src();
        let ret_pos = Position { line, utf16_col };
        if loc.start == loc.end {
            return Some(ret_pos..ret_pos);
        }
        let end_diff = if loc.end.utf16_col > 0 { 1 } else { 0 };
        let ret_end_pos = match self
            .source_map
            .lookup_token(loc.end.line, loc.end.utf16_col - end_diff)
        {
            None => ret_pos,
            Some(token) => {
                let line = token.get_src_line();
                let col = token.get_src_col();
                let len = token.get_name().map(|s| s.len() as u32).unwrap_or(0);
                Position {
                    line,
                    utf16_col: col + len,
                }
            }
        };
        Some(ret_pos..ret_end_pos)
    }

    /// Get the token information of the given source code location.
    ///
    /// Returns the range in the source code and the start position in the TypeScript code.
    pub fn get_token_at_source_position(
        &self,
        pos: Position,
    ) -> Option<(Range<Position>, Position)> {
        for token in self.source_map.tokens() {
            let Some(name) = token.get_name() else {
                continue;
            };
            let (src_start_line, src_start_col) = token.get_src();
            if src_start_line != pos.line {
                continue;
            };
            let src_end_line = src_start_line;
            let src_end_col = src_start_col + name.len() as u32;
            if !(src_start_col..=src_end_col).contains(&pos.utf16_col) {
                continue;
            }
            let (dst_start_line, dst_start_col) = token.get_dst();
            let source_start = Position {
                line: src_start_line,
                utf16_col: src_start_col,
            };
            let source_end = Position {
                line: src_end_line,
                utf16_col: src_end_col,
            };
            let dest = Position {
                line: dst_start_line,
                utf16_col: dst_start_col,
            };
            return Some((source_start..source_end, dest));
        }
        None
    }
}

#[wasm_bindgen]
impl TmplConvertedExpr {
    #[wasm_bindgen(js_name = "code")]
    pub fn js_code(&self) -> Option<js_sys::JsString> {
        js_sys::JsString::from_str(&self.code).ok()
    }

    #[wasm_bindgen(js_name = "getSourceLocation")]
    pub fn js_get_source_location(
        &self,
        start_line: u32,
        start_col: u32,
        end_line: u32,
        end_col: u32,
    ) -> Option<Vec<u32>> {
        let start = Position {
            line: start_line,
            utf16_col: start_col,
        };
        let end = Position {
            line: end_line,
            utf16_col: end_col,
        };
        let ret = self.get_source_location(start..end)?;
        Some(vec![
            ret.start.line,
            ret.start.utf16_col,
            ret.end.line,
            ret.end.utf16_col,
        ])
    }

    #[wasm_bindgen(js_name = "getTokenAtSourcePosition")]
    pub fn js_get_token_at_source_position(&self, line: u32, col: u32) -> Option<Vec<u32>> {
        let (src, dest) = self.get_token_at_source_position(Position {
            line,
            utf16_col: col,
        })?;
        Some(vec![
            src.start.line,
            src.start.utf16_col,
            src.end.line,
            src.end.utf16_col,
            dest.line,
            dest.utf16_col,
        ])
    }
}

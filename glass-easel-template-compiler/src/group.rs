//! The template group for cross references

use crate::escape::gen_lit_str;
use crate::proc_gen::{JsFunctionScopeWriter, JsWriter};
use std::collections::HashMap;
use std::fmt;
use std::fmt::Write;

use super::*;

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
// P: the current path
// Q
// R: the global script module / the `ProcGenWrapper` object
// S: the `DefineSlot` function
// T: the `DefineTextNode` function / the `updateText` function
// U: the update path tree
// V: the current slot values
// W: the update path trees of current slot values
// X (preserved for runtime)
// Y (preserved for runtime)
// Z (preserved for runtime)

const RUNTIME_ITEMS: [(&'static str, &'static str); 3] = [
    ("X", "function(a){return a==null?Object.create(null):a}"),
    ("Y", "function(a){return a==null?'':String(a)}"),
    (
        "Z",
        "function(a,b){if(a===true)return true;if(a)return a[b]}",
    ),
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

fn runtime_fns<W: std::fmt::Write>(w: &mut JsFunctionScopeWriter<W>, need_wxs_runtime: bool) -> Result<(), TmplError> {
    for (k, v) in RUNTIME_ITEMS.iter() {
        w.expr_stmt(|w| {
            write!(w, "var {}={}", k, v)?;
            Ok(())
        })?;
    }
    if need_wxs_runtime {
        w.expr_stmt(|w| {
            write!(w, "{}", WXS_RUNTIME)?;
            Ok(())
        })?;
    }
    Ok(())
}

fn runtime_var_list() -> Vec<&'static str> {
    RUNTIME_ITEMS.iter().map(|(k, _)| *k).collect()
}

/// Template parsing error object.
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

pub(crate) mod path {
    pub(crate) fn normalize(path: &str) -> String {
        let mut slices = vec![];
        for slice in path.split('/') {
            match slice {
                "." => {}
                ".." => {
                    slices.pop();
                }
                _ => {
                    slices.push(slice);
                }
            }
        }
        slices.join("/")
    }

    pub(crate) fn resolve(base: &str, rel: &str) -> String {
        let mut slices = vec![];
        let main = if rel.starts_with('/') {
            &rel[1..]
        } else {
            for slice in base.split('/') {
                match slice {
                    "." => {}
                    ".." => {
                        slices.pop();
                    }
                    _ => {
                        slices.push(slice);
                    }
                }
            }
            rel
        };
        slices.pop();
        for slice in main.split('/') {
            match slice {
                "." => {}
                ".." => {
                    slices.pop();
                }
                _ => {
                    slices.push(slice);
                }
            }
        }
        slices.join("/")
    }
}

/// A template group in which the templates can ref each other.
pub struct TmplGroup {
    trees: HashMap<String, TmplTree>,
    scripts: HashMap<String, String>,
    extra_runtime_string: String,
}

impl fmt::Debug for TmplGroup {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for (name, tree) in self.trees.iter() {
            writeln!(f, "{}", name)?;
            writeln!(f, "{}", tree)?;
        }
        Ok(())
    }
}

impl TmplGroup {
    /// Create a new template group.
    pub fn new() -> Self {
        Self {
            trees: HashMap::new(),
            scripts: HashMap::new(),
            extra_runtime_string: String::new(),
        }
    }

    /// Add a ref of a parsed tree in the group.
    pub fn get_tree(&self, path: &str) -> Result<&TmplTree, TmplError> {
        match self.trees.get(path) {
            Some(x) => Ok(x),
            None => Err(TmplError {
                message: format!(r#"no template "{}" found"#, path),
            }),
        }
    }

    /// Add a template into the group.
    pub fn add_tmpl(&mut self, path: &str, tmpl_str: &str) -> Result<(), TmplParseError> {
        let mut tmpl = parse_tmpl(tmpl_str)?;
        tmpl.path = path.to_string();
        self.trees.insert(tmpl.path.clone(), tmpl);
        Ok(())
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
    pub fn add_script(&mut self, path: &str, content: &str) -> Result<(), TmplParseError> {
        self.scripts.insert(path.to_string(), content.to_string());
        Ok(())
    }

    /// Set extra runtime JavaScript code as a string.
    /// 
    /// The `content` must be valid JavaScript statements, ended by semicolon.
    pub fn set_extra_runtime_script(&mut self, content: &str) {
        self.extra_runtime_string = content.to_string();
    }

    /// Output js runtime environment js code string.
    pub fn get_runtime_string(&self) -> String {
        let mut w = JsWriter::new(String::new());
        w.function_scope(|w| {
            runtime_fns(w, self.scripts.len() > 0)?;
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
    pub fn get_direct_dependencies(&self, path: &str) -> Result<Vec<String>, TmplError> {
        Ok(self.get_tree(path)?.get_direct_dependencies())
    }

    /// Get dependency script files.
    pub fn get_script_dependencies(&self, path: &str) -> Result<Vec<String>, TmplError> {
        Ok(self.get_tree(path)?.get_script_dependencies())
    }

    /// Get inline script module names.
    pub fn get_inline_script_module_names(&self, path: &str) -> Result<Vec<String>, TmplError> {
        Ok(self.get_tree(path)?.get_inline_script_module_names())
    }

    /// Get inline script content.
    pub fn get_inline_script(&self, path: &str, module_name: &str) -> Result<Option<&str>, TmplError> {
        Ok(self.get_tree(path)?.get_inline_script(module_name))
    }

    /// Convert to WXML GenObject js string.
    pub fn get_tmpl_gen_object(&self, path: &str) -> Result<String, TmplError> {
        let tree = self.get_tree(path)?;
        let mut w = JsWriter::new(String::new());
        w.expr_scope(|w| {
            tree.to_proc_gen(w, self)?;
            Ok(())
        })?;
        Ok(w.finish())
    }

    fn write_group_global_content(&self, w: &mut JsFunctionScopeWriter<String>) -> Result<(), TmplError> {
        runtime_fns(w, self.scripts.len() > 0)?;
        if self.extra_runtime_string.len() > 0 {
            w.custom_stmt_str(&self.extra_runtime_string)?;
        }
        if self.scripts.len() > 0 {
            w.expr_stmt(|w| {
                write!(w, "var R={{}}")?;
                Ok(())
            })?;
            for (p, script) in self.scripts.iter() {
                w.expr_stmt(|w| {
                    write!(w, r#"R[{path}]=D({path},(require,exports,module)=>{{{}}})"#, script, path = gen_lit_str(p))?;
                    Ok(())
                })?;
            }
        }
        Ok(())
    }

    /// Convert all to WXML GenObject js string
    pub fn get_tmpl_gen_object_groups(&self) -> Result<String, TmplError> {
        let mut w = JsWriter::new(String::new());
        w.expr_scope(|w| {
            w.paren(|w| {
                w.function(|w| {
                    self.write_group_global_content(w)?;
                    w.expr_stmt(|w| {
                        write!(w, "var G={{}}")?;
                        Ok(())
                    })?;
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

    /// Convert all to WXML GenObject js string, with wx environment support
    pub fn get_wx_gen_object_groups(&self) -> Result<String, TmplError> {
        let mut w = JsWriter::new(String::new());
        w.expr_scope(|w| {
            w.paren(|w| {
                w.function(|w| {
                    self.write_group_global_content(w)?;
                    w.expr_stmt(|w| {
                        write!(w, "var G={{}}")?;
                        Ok(())
                    })?;
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

    /// Returns the number of templates in the group
    pub fn len(&self) -> usize {
        self.trees.len()
    }

    /// Check if the group contains certain template
    pub fn contains_template(&self, path: &str) -> bool {
        self.trees.contains_key(path)
    }
}

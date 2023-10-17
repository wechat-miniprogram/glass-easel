use std::fmt;
use std::fmt::Write;

use crate::TmplError;

const VAR_NAME_CHARS: [char; 63] = [
    '_', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a',
    'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z',
];
const VAR_NAME_START_CHARS: [char; 52] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
    'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
];
const VAR_NAME_INDEX_PRESERVE: usize = 26; // 'A' ~ 'Z' are preserved

#[derive(Debug, Clone)]
pub(crate) struct JsIdent {
    name: String,
}

impl fmt::Display for JsIdent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name)
    }
}

#[derive(Clone)]
struct JsBlockStat {
    need_stat_sep: bool,
    ident_id_inc: usize,
}

impl JsBlockStat {
    fn new() -> Self {
        Self {
            need_stat_sep: false,
            ident_id_inc: VAR_NAME_INDEX_PRESERVE,
        }
    }

    fn extend(&self) -> Self {
        Self {
            need_stat_sep: false,
            ident_id_inc: self.ident_id_inc,
        }
    }

    fn align(&mut self, extended: Self) {
        self.ident_id_inc = extended.ident_id_inc;
    }
}

pub(crate) struct JsWriter<W: fmt::Write> {
    w: W,
}

impl<W: fmt::Write> JsWriter<W> {
    pub(crate) fn new(w: W) -> Self {
        Self { w }
    }

    pub(crate) fn finish(self) -> W {
        self.w
    }

    pub(crate) fn function_scope<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let w = &mut JsFunctionScopeWriter {
            w: self,
            block: JsBlockStat::new(),
        };
        f(w)
    }

    pub(crate) fn expr_scope<R>(
        &mut self,
        f: impl FnOnce(&mut JsExprWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let w = &mut JsExprWriter {
            w: self,
            block: &mut JsBlockStat::new(),
        };
        f(w)
    }
}

impl<W: fmt::Write> fmt::Write for JsWriter<W> {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        write!(&mut self.w, "{}", s)
    }
}

pub(crate) struct JsFunctionScopeWriter<'a, W: fmt::Write> {
    w: &'a mut JsWriter<W>,
    block: JsBlockStat,
}

impl<'a, W: fmt::Write> JsFunctionScopeWriter<'a, W> {
    pub(crate) fn gen_ident(&mut self) -> JsIdent {
        let mut var_id = self.block.ident_id_inc;
        self.block.ident_id_inc += 1;
        let mut var_name = String::new();
        var_name.push(VAR_NAME_START_CHARS[var_id % VAR_NAME_START_CHARS.len()]);
        var_id /= VAR_NAME_START_CHARS.len();
        while var_id > 0 {
            var_name.push(VAR_NAME_CHARS[var_id % VAR_NAME_CHARS.len()]);
            var_id /= VAR_NAME_CHARS.len();
        }
        JsIdent { name: var_name }
    }

    pub(crate) fn custom_stmt_str(
        &mut self,
        content: &str,
    ) -> Result<(), TmplError> {
        if self.block.need_stat_sep {
            write!(&mut self.w, ";")?;
        }
        self.block.need_stat_sep = false;
        write!(&mut self.w, "{}", content)?;
        Ok(())
    }

    fn stat<R>(
        &mut self,
        f: impl FnOnce(&mut Self) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        if self.block.need_stat_sep {
            write!(&mut self.w, ";")?;
        } else {
            self.block.need_stat_sep = true;
        }
        let ret = f(self)?;
        Ok(ret)
    }

    pub(crate) fn expr_stmt<R>(
        &mut self,
        f: impl FnOnce(&mut JsExprWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        self.stat(|this| {
            let ret = f(&mut JsExprWriter {
                w: this.w,
                block: &mut this.block,
            })?;
            Ok(ret)
        })
    }
}

pub(crate) struct JsExprWriter<'a, W: fmt::Write> {
    w: &'a mut JsWriter<W>,
    block: &'a mut JsBlockStat,
}

impl<'a, W: fmt::Write> JsExprWriter<'a, W> {
    pub(crate) fn function<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "()=>{{")?;
        let ret = f(&mut JsFunctionScopeWriter {
            w: self.w,
            block: self.block.extend(),
        })?;
        write!(&mut self.w, "}}")?;
        Ok(ret)
    }

    pub(crate) fn function_args<R>(
        &mut self,
        args: &str,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "({})=>{{", args)?;
        let ret = f(&mut JsFunctionScopeWriter {
            w: self.w,
            block: self.block.extend(),
        })?;
        write!(&mut self.w, "}}")?;
        Ok(ret)
    }

    pub(crate) fn brace_block<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "{{")?;
        let child_block = self.block.extend();
        let mut child_scope = JsFunctionScopeWriter {
            w: self.w,
            block: child_block,
        };
        let ret = f(&mut child_scope)?;
        self.block.align(child_scope.block);
        write!(&mut self.w, "}}")?;
        Ok(ret)
    }

    pub(crate) fn paren<R>(
        &mut self,
        f: impl FnOnce(&mut Self) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "(")?;
        let ret = f(self)?;
        write!(&mut self.w, ")")?;
        Ok(ret)
    }
}

impl<'a, W: fmt::Write> fmt::Write for JsExprWriter<'a, W> {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        write!(&mut self.w, "{}", s)
    }
}

pub(crate) struct ScopeVar {
    pub(crate) var: JsIdent,
    pub(crate) update_path_tree: Option<JsIdent>,
    pub(crate) lvalue_path: ScopeVarLvaluePath,
}

pub(crate) enum ScopeVarLvaluePath {
    Invalid,
    Var {
        var_name: JsIdent,
        from_data_scope: bool,
    },
    Script {
        abs_path: String,
    },
    InlineScript {
        path: String,
        mod_name: String,
    },
}

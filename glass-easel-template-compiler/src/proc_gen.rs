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
    private_ident_id_inc: usize,
}

impl JsBlockStat {
    fn new() -> Self {
        Self {
            need_stat_sep: false,
            ident_id_inc: VAR_NAME_INDEX_PRESERVE,
            private_ident_id_inc: 0,
        }
    }

    fn extend(&self) -> Self {
        Self {
            need_stat_sep: false,
            ident_id_inc: self.ident_id_inc,
            private_ident_id_inc: self.private_ident_id_inc,
        }
    }

    fn align(&mut self, extended: &Self) {
        self.ident_id_inc = extended.ident_id_inc;
        self.private_ident_id_inc = extended.private_ident_id_inc;
    }
}

pub(crate) struct JsTopScopeWriter<W: fmt::Write> {
    w: W,
    top_declares: Vec<String>,
    sub_strs: Vec<String>,
    block: JsBlockStat,
}

impl<'a, W: fmt::Write> JsTopScopeWriter<W> {
    pub(crate) fn new(w: W) -> Self {
        Self {
            w,
            top_declares: vec![],
            sub_strs: vec![],
            block: JsBlockStat::new(),
        }
    }

    pub(crate) fn finish(self) -> W {
        let mut w = self.w;
        let mut first = true;
        if self.top_declares.len() > 0 {
            write!(w, "var ").unwrap();
            for (index, top_declare) in self.top_declares.iter().enumerate() {
                if index > 0 {
                    write!(w, ",").unwrap();
                }
                write!(w, "{}", top_declare).unwrap();
            }
            first = false;
        }
        for sub_str in self.sub_strs.iter() {
            if first {
                first = false
            } else {
                write!(w, ";").unwrap();
            }
            write!(w, "{}", sub_str).unwrap();
        }
        w
    }

    pub(crate) fn function_scope<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let mut sub_str = String::new();
        let need_stat_sep = self.block.need_stat_sep;
        self.block.need_stat_sep = false;
        let ret = f(&mut JsFunctionScopeWriter {
            w: &mut sub_str,
            block: None,
            top_scope: self,
        });
        self.sub_strs.push(sub_str);
        self.block.need_stat_sep = need_stat_sep;
        ret
    }

    pub(crate) fn expr_scope<R>(
        &mut self,
        f: impl FnOnce(&mut JsExprWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        self.function_scope(|w| w.expr_stmt(f))
    }

    pub(crate) fn declare_on_top(
        &mut self,
        name: &str,
    ) -> Result<(), TmplError> {
        let mut sub_str = String::new();
        let need_stat_sep = self.block.need_stat_sep;
        self.block.need_stat_sep = false;
        write!(sub_str, "{}", name).unwrap();
        self.top_declares.push(sub_str);
        self.block.need_stat_sep = need_stat_sep;
        Ok(())
    }

    pub(crate) fn declare_on_top_init<R>(
        &mut self,
        name: &str,
        init: impl FnOnce(&mut JsExprWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let mut sub_str = String::new();
        let need_stat_sep = self.block.need_stat_sep;
        self.block.need_stat_sep = false;
        write!(sub_str, "{}=", name).unwrap();
        let ret = init(&mut JsExprWriter {
            w: &mut sub_str,
            block: None,
            top_scope: self,
        });
        self.top_declares.push(sub_str);
        self.block.need_stat_sep = need_stat_sep;
        ret
    }
}

pub(crate) struct JsFunctionScopeWriter<'a, W: fmt::Write> {
    w: &'a mut String,
    block: Option<&'a mut JsBlockStat>,
    top_scope: &'a mut JsTopScopeWriter<W>,
}

fn get_var_name(mut var_id: usize) -> String {
    let mut var_name = String::new();
    var_name.push(VAR_NAME_START_CHARS[var_id % VAR_NAME_START_CHARS.len()]);
    var_id /= VAR_NAME_START_CHARS.len();
    while var_id > 0 {
        var_name.push(VAR_NAME_CHARS[var_id % VAR_NAME_CHARS.len()]);
        var_id /= VAR_NAME_CHARS.len();
    }
    var_name
}

impl<'a, W: fmt::Write> JsFunctionScopeWriter<'a, W> {
    fn get_block(&mut self) -> &mut JsBlockStat {
        if self.block.is_some() {
            self.block.as_mut().unwrap()
        } else {
            &mut self.top_scope.block
        }
    }

    pub(crate) fn gen_ident(&mut self) -> JsIdent {
        let block = self.get_block();
        let var_id = block.ident_id_inc;
        block.ident_id_inc += 1;
        JsIdent {
            name: get_var_name(var_id),
        }
    }

    pub(crate) fn gen_private_ident(&mut self) -> JsIdent {
        let block = self.get_block();
        let var_id = block.private_ident_id_inc;
        block.private_ident_id_inc += 1;
        JsIdent {
            name: format!("${}", get_var_name(var_id)),
        }
    }

    pub(crate) fn custom_stmt_str(&mut self, content: &str) -> Result<(), TmplError> {
        let block = self.get_block();
        if block.need_stat_sep {
            block.need_stat_sep = false;
            write!(&mut self.w, ";")?;
        }
        write!(&mut self.w, "{}", content)?;
        Ok(())
    }

    fn stat<R>(
        &mut self,
        f: impl FnOnce(&mut Self) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let block = self.get_block();
        if block.need_stat_sep {
            write!(&mut self.w, ";")?;
        } else {
            block.need_stat_sep = true;
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
                block: if this.block.is_some() {
                    Some(this.block.as_mut().unwrap())
                } else {
                    None
                },
                top_scope: &mut this.top_scope,
            })?;
            Ok(ret)
        })
    }

    pub(crate) fn set_var_on_top_scope(&mut self, name: &str) -> Result<(), TmplError> {
        self.top_scope.declare_on_top(name)
    }

    pub(crate) fn declare_var_on_top_scope(&mut self) -> Result<JsIdent, TmplError> {
        let block = &mut self.top_scope.block;
        let var_id = block.ident_id_inc;
        block.ident_id_inc += 1;
        let ident = JsIdent { name: get_var_name(var_id) };
        self.top_scope.declare_on_top(&ident.name)?;
        Ok(ident)
    }

    pub(crate) fn declare_var_on_top_scope_init<R>(
        &mut self,
        init: impl FnOnce(&mut JsExprWriter<W>, JsIdent) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        let block = &mut self.top_scope.block;
        let var_id = block.ident_id_inc;
        block.ident_id_inc += 1;
        let var_name = get_var_name(var_id);
        let ident = JsIdent { name: var_name.clone() };
        self.top_scope.declare_on_top_init(&var_name, |w| {
            init(w, ident)
        })
    }
}

pub(crate) struct JsExprWriter<'a, W: fmt::Write> {
    w: &'a mut String,
    block: Option<&'a mut JsBlockStat>,
    top_scope: &'a mut JsTopScopeWriter<W>,
}

impl<'a, W: fmt::Write> JsExprWriter<'a, W> {
    fn get_block(&mut self) -> &mut JsBlockStat {
        if self.block.is_some() {
            self.block.as_mut().unwrap()
        } else {
            &mut self.top_scope.block
        }
    }

    pub(crate) fn function<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "()=>{{")?;

        let mut block = self.get_block().extend();
        let ret = f(&mut JsFunctionScopeWriter {
            w: self.w,
            block: Some(&mut block),
            top_scope: &mut self.top_scope,
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
        let mut block = self.get_block().extend();
        let ret = f(&mut JsFunctionScopeWriter {
            w: self.w,
            block: Some(&mut block),
            top_scope: &mut self.top_scope,
        })?;
        write!(&mut self.w, "}}")?;
        Ok(ret)
    }

    pub(crate) fn brace_block<R>(
        &mut self,
        f: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<R, TmplError>,
    ) -> Result<R, TmplError> {
        write!(&mut self.w, "{{")?;
        let block = self.get_block();
        let mut child_block = block.extend();
        let mut child_scope = JsFunctionScopeWriter {
            w: self.w,
            block: Some(&mut child_block),
            top_scope: &mut self.top_scope,
        };
        let ret = f(&mut child_scope)?;
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

    pub(crate) fn declare_var_on_top_scope(&mut self) -> Result<JsIdent, TmplError> {
        let block = &mut self.top_scope.block;
        let var_id = block.ident_id_inc;
        block.ident_id_inc += 1;
        let ident = JsIdent { name: get_var_name(var_id) };
        self.top_scope.declare_on_top(&ident.name)?;
        Ok(ident)
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

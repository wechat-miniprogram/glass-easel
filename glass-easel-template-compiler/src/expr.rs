//! The parsed expr structure

use crate::binding_map::{BindingMapCollector, BindingMapKeys};
use crate::escape::gen_lit_str;
use crate::proc_gen::{JsExprWriter, JsFunctionScopeWriter, JsIdent, ScopeVar, ScopeVarLvaluePath};
use crate::TmplError;
use std::fmt;
use std::fmt::Write;

#[derive(Debug, Clone)]
pub(crate) enum TmplExpr {
    ScopeIndex(usize),
    Ident(String),
    ToStringWithoutUndefined(Box<TmplExpr>),

    LitUndefined,
    LitNull,
    LitStr(String),
    LitInt(i32),
    LitFloat(f64),
    LitBool(bool),
    LitObj(Vec<(Option<String>, TmplExpr)>), // None refers to spread op
    LitArr(Vec<TmplExpr>),

    StaticMember(Box<TmplExpr>, String),
    DynamicMember(Box<TmplExpr>, Box<TmplExpr>),
    FuncCall(Box<TmplExpr>, Vec<TmplExpr>),

    Reverse(Box<TmplExpr>),
    BitReverse(Box<TmplExpr>),
    Positive(Box<TmplExpr>),
    Negative(Box<TmplExpr>),
    TypeOf(Box<TmplExpr>),
    Void(Box<TmplExpr>),

    Multiply(Box<TmplExpr>, Box<TmplExpr>),
    Divide(Box<TmplExpr>, Box<TmplExpr>),
    Mod(Box<TmplExpr>, Box<TmplExpr>),
    Plus(Box<TmplExpr>, Box<TmplExpr>),
    Minus(Box<TmplExpr>, Box<TmplExpr>),

    Lt(Box<TmplExpr>, Box<TmplExpr>),
    Gt(Box<TmplExpr>, Box<TmplExpr>),
    Lte(Box<TmplExpr>, Box<TmplExpr>),
    Gte(Box<TmplExpr>, Box<TmplExpr>),
    Eq(Box<TmplExpr>, Box<TmplExpr>),
    Ne(Box<TmplExpr>, Box<TmplExpr>),
    EqFull(Box<TmplExpr>, Box<TmplExpr>),
    NeFull(Box<TmplExpr>, Box<TmplExpr>),

    BitAnd(Box<TmplExpr>, Box<TmplExpr>),
    BitXor(Box<TmplExpr>, Box<TmplExpr>),
    BitOr(Box<TmplExpr>, Box<TmplExpr>),
    LogicAnd(Box<TmplExpr>, Box<TmplExpr>),
    LogicOr(Box<TmplExpr>, Box<TmplExpr>),

    Cond(Box<TmplExpr>, Box<TmplExpr>, Box<TmplExpr>),
}

#[derive(Debug, PartialEq, PartialOrd)]
enum TmplExprLevel {
    Lit = 0,
    Member = 1,
    Unary = 2,
    Multiply = 3,
    Plus = 4,
    Comparison = 5,
    Eq = 6,
    BitAnd = 7,
    BitXor = 8,
    BitOr = 9,
    LogicAnd = 10,
    LogicOr = 11,
    Cond = 12,
    Comma = 13,
}

impl TmplExpr {
    fn level(&self) -> TmplExprLevel {
        match self {
            TmplExpr::ScopeIndex(_) => TmplExprLevel::Member,
            TmplExpr::Ident(_) => TmplExprLevel::Lit,
            TmplExpr::ToStringWithoutUndefined(_) => TmplExprLevel::Member,
            TmplExpr::LitUndefined => TmplExprLevel::Lit,
            TmplExpr::LitNull => TmplExprLevel::Lit,
            TmplExpr::LitStr(_) => TmplExprLevel::Lit,
            TmplExpr::LitInt(_) => TmplExprLevel::Lit,
            TmplExpr::LitFloat(_) => TmplExprLevel::Lit,
            TmplExpr::LitBool(_) => TmplExprLevel::Lit,
            TmplExpr::LitObj(_) => TmplExprLevel::Lit,
            TmplExpr::LitArr(_) => TmplExprLevel::Lit,
            TmplExpr::StaticMember(_, _) => TmplExprLevel::Member,
            TmplExpr::DynamicMember(_, _) => TmplExprLevel::Member,
            TmplExpr::FuncCall(_, _) => TmplExprLevel::Member,
            TmplExpr::Reverse(_) => TmplExprLevel::Unary,
            TmplExpr::BitReverse(_) => TmplExprLevel::Unary,
            TmplExpr::Positive(_) => TmplExprLevel::Unary,
            TmplExpr::Negative(_) => TmplExprLevel::Unary,
            TmplExpr::TypeOf(_) => TmplExprLevel::Unary,
            TmplExpr::Void(_) => TmplExprLevel::Unary,
            TmplExpr::Multiply(_, _) => TmplExprLevel::Multiply,
            TmplExpr::Divide(_, _) => TmplExprLevel::Multiply,
            TmplExpr::Mod(_, _) => TmplExprLevel::Multiply,
            TmplExpr::Plus(_, _) => TmplExprLevel::Plus,
            TmplExpr::Minus(_, _) => TmplExprLevel::Plus,
            TmplExpr::Lt(_, _) => TmplExprLevel::Comparison,
            TmplExpr::Gt(_, _) => TmplExprLevel::Comparison,
            TmplExpr::Lte(_, _) => TmplExprLevel::Comparison,
            TmplExpr::Gte(_, _) => TmplExprLevel::Comparison,
            TmplExpr::Eq(_, _) => TmplExprLevel::Eq,
            TmplExpr::Ne(_, _) => TmplExprLevel::Eq,
            TmplExpr::EqFull(_, _) => TmplExprLevel::Eq,
            TmplExpr::NeFull(_, _) => TmplExprLevel::Eq,
            TmplExpr::BitAnd(_, _) => TmplExprLevel::BitAnd,
            TmplExpr::BitXor(_, _) => TmplExprLevel::BitXor,
            TmplExpr::BitOr(_, _) => TmplExprLevel::BitOr,
            TmplExpr::LogicAnd(_, _) => TmplExprLevel::LogicAnd,
            TmplExpr::LogicOr(_, _) => TmplExprLevel::LogicOr,
            TmplExpr::Cond(_, _, _) => TmplExprLevel::Cond,
        }
    }

    fn to_expr_string(&self, allow_level: TmplExprLevel, is_js_target: bool) -> String {
        if self.level() > allow_level {
            return format!(
                "({})",
                self.to_expr_string(TmplExprLevel::Comma, is_js_target)
            );
        }
        match self {
            TmplExpr::ScopeIndex(index) => {
                if is_js_target {
                    format!("S({})", index)
                } else {
                    format!("${}", index)
                }
            }
            TmplExpr::Ident(x) => {
                if is_js_target {
                    format!("D.{}", x)
                } else {
                    format!("{}", x)
                }
            }
            TmplExpr::ToStringWithoutUndefined(x) => {
                format!("Y({})", x.to_expr_string(TmplExprLevel::Cond, is_js_target))
            }

            TmplExpr::LitUndefined => "undefined".to_string(),
            TmplExpr::LitNull => "null".to_string(),
            TmplExpr::LitStr(x) => gen_lit_str(x),
            TmplExpr::LitInt(x) => {
                format!("{}", x)
            }
            TmplExpr::LitFloat(x) => {
                format!("{}", x)
            }
            TmplExpr::LitBool(x) => {
                format!("{}", x)
            }
            TmplExpr::LitObj(x) => {
                let mut r = String::from("{}");
                let mut s: Vec<String> = vec![];
                for x in x.iter() {
                    let v_string = x.1.to_expr_string(TmplExprLevel::Cond, is_js_target);
                    match &x.0 {
                        Some(k) => s.push(format!("{}:{}", &k, v_string)),
                        None => {
                            if is_js_target {
                                if s.len() > 0 {
                                    r = format!(
                                        "Object.assign({},{{{}}},{})",
                                        r,
                                        s.join(","),
                                        v_string
                                    );
                                    s.truncate(0);
                                } else {
                                    r = format!("Object.assign({},{})", r, v_string);
                                }
                            } else {
                                s.push(format!("...{}", v_string))
                            }
                        }
                    }
                }
                let merged_s = format!("{{{}}}", s.join(","));
                if r.len() > 2 {
                    if s.len() > 0 {
                        format!("Object.assign({},{})", r, merged_s)
                    } else {
                        r
                    }
                } else {
                    merged_s
                }
            }
            TmplExpr::LitArr(x) => {
                let s: Vec<String> = x
                    .iter()
                    .map(|x| x.to_expr_string(TmplExprLevel::Cond, is_js_target))
                    .collect();
                format!("[{}]", s.join(","))
            }

            TmplExpr::StaticMember(x, y) => {
                format!(
                    "X({}).{}",
                    x.to_expr_string(TmplExprLevel::Cond, is_js_target),
                    y
                )
            }
            TmplExpr::DynamicMember(x, y) => {
                format!(
                    "X({})[{}]",
                    x.to_expr_string(TmplExprLevel::Cond, is_js_target),
                    y.to_expr_string(TmplExprLevel::Cond, is_js_target)
                )
            }
            TmplExpr::FuncCall(x, y) => {
                let s: Vec<String> = y
                    .iter()
                    .map(|x| x.to_expr_string(TmplExprLevel::Cond, is_js_target))
                    .collect();
                format!(
                    "{}({})",
                    x.to_expr_string(TmplExprLevel::Member, is_js_target),
                    s.join(",")
                )
            }

            TmplExpr::Reverse(x) => {
                format!("!{}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }
            TmplExpr::BitReverse(x) => {
                format!("~{}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }
            TmplExpr::Positive(x) => {
                format!("+{}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }
            TmplExpr::Negative(x) => {
                format!("-{}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }
            TmplExpr::TypeOf(x) => {
                format!("typeof {}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }
            TmplExpr::Void(x) => {
                format!("void {}", x.to_expr_string(TmplExprLevel::Unary, is_js_target))
            }

            TmplExpr::Multiply(x, y) => {
                format!(
                    "{}*{}",
                    x.to_expr_string(TmplExprLevel::Multiply, is_js_target),
                    y.to_expr_string(TmplExprLevel::Unary, is_js_target)
                )
            }
            TmplExpr::Divide(x, y) => {
                format!(
                    "{}/{}",
                    x.to_expr_string(TmplExprLevel::Multiply, is_js_target),
                    y.to_expr_string(TmplExprLevel::Unary, is_js_target)
                )
            }
            TmplExpr::Mod(x, y) => {
                format!(
                    "{}%{}",
                    x.to_expr_string(TmplExprLevel::Multiply, is_js_target),
                    y.to_expr_string(TmplExprLevel::Unary, is_js_target)
                )
            }
            TmplExpr::Plus(x, y) => {
                format!(
                    "{}+{}",
                    x.to_expr_string(TmplExprLevel::Plus, is_js_target),
                    y.to_expr_string(TmplExprLevel::Multiply, is_js_target)
                )
            }
            TmplExpr::Minus(x, y) => {
                format!(
                    "{}-{}",
                    x.to_expr_string(TmplExprLevel::Plus, is_js_target),
                    y.to_expr_string(TmplExprLevel::Multiply, is_js_target)
                )
            }

            TmplExpr::Lt(x, y) => {
                format!(
                    "{}<{}",
                    x.to_expr_string(TmplExprLevel::Comparison, is_js_target),
                    y.to_expr_string(TmplExprLevel::Plus, is_js_target)
                )
            }
            TmplExpr::Gt(x, y) => {
                format!(
                    "{}>{}",
                    x.to_expr_string(TmplExprLevel::Comparison, is_js_target),
                    y.to_expr_string(TmplExprLevel::Plus, is_js_target)
                )
            }
            TmplExpr::Lte(x, y) => {
                format!(
                    "{}<={}",
                    x.to_expr_string(TmplExprLevel::Comparison, is_js_target),
                    y.to_expr_string(TmplExprLevel::Plus, is_js_target)
                )
            }
            TmplExpr::Gte(x, y) => {
                format!(
                    "{}>={}",
                    x.to_expr_string(TmplExprLevel::Comparison, is_js_target),
                    y.to_expr_string(TmplExprLevel::Plus, is_js_target)
                )
            }
            TmplExpr::Eq(x, y) => {
                format!(
                    "{}=={}",
                    x.to_expr_string(TmplExprLevel::Eq, is_js_target),
                    y.to_expr_string(TmplExprLevel::Comparison, is_js_target)
                )
            }
            TmplExpr::Ne(x, y) => {
                format!(
                    "{}!={}",
                    x.to_expr_string(TmplExprLevel::Eq, is_js_target),
                    y.to_expr_string(TmplExprLevel::Comparison, is_js_target)
                )
            }
            TmplExpr::EqFull(x, y) => {
                format!(
                    "{}==={}",
                    x.to_expr_string(TmplExprLevel::Eq, is_js_target),
                    y.to_expr_string(TmplExprLevel::Comparison, is_js_target)
                )
            }
            TmplExpr::NeFull(x, y) => {
                format!(
                    "{}!=={}",
                    x.to_expr_string(TmplExprLevel::Eq, is_js_target),
                    y.to_expr_string(TmplExprLevel::Comparison, is_js_target)
                )
            }

            TmplExpr::BitAnd(x, y) => {
                format!(
                    "{}&{}",
                    x.to_expr_string(TmplExprLevel::BitAnd, is_js_target),
                    y.to_expr_string(TmplExprLevel::Eq, is_js_target)
                )
            }
            TmplExpr::BitXor(x, y) => {
                format!(
                    "{}^{}",
                    x.to_expr_string(TmplExprLevel::BitXor, is_js_target),
                    y.to_expr_string(TmplExprLevel::BitAnd, is_js_target)
                )
            }
            TmplExpr::BitOr(x, y) => {
                format!(
                    "{}|{}",
                    x.to_expr_string(TmplExprLevel::BitOr, is_js_target),
                    y.to_expr_string(TmplExprLevel::BitXor, is_js_target)
                )
            }
            TmplExpr::LogicAnd(x, y) => {
                format!(
                    "{}&&{}",
                    x.to_expr_string(TmplExprLevel::LogicAnd, is_js_target),
                    y.to_expr_string(TmplExprLevel::BitOr, is_js_target)
                )
            }
            TmplExpr::LogicOr(x, y) => {
                format!(
                    "{}||{}",
                    x.to_expr_string(TmplExprLevel::LogicOr, is_js_target),
                    y.to_expr_string(TmplExprLevel::LogicAnd, is_js_target)
                )
            }

            TmplExpr::Cond(x, y, z) => {
                format!(
                    "{}?{}:{}",
                    x.to_expr_string(TmplExprLevel::LogicOr, is_js_target),
                    y.to_expr_string(TmplExprLevel::Cond, is_js_target),
                    z.to_expr_string(TmplExprLevel::Cond, is_js_target)
                )
            }
        }
    }
}

#[must_use]
#[derive(Debug)]
pub(crate) enum PathSlice {
    Ident(String),
    ScopeIndex(usize),
    StaticMember(String),
    IndirectValue(JsIdent),
    CombineObj(Vec<(Option<String>, PathAnalysisState, Vec<PathSliceList>)>),
    CombineArr(Vec<(PathAnalysisState, Vec<PathSliceList>)>),
    Condition(JsIdent, (PathAnalysisState, Vec<PathSliceList>), (PathAnalysisState, Vec<PathSliceList>)),
}

#[derive(Debug)]
pub(crate) struct PathSliceList(Vec<PathSlice>);

impl PathSliceList {
    fn to_path_analysis_str_group_prefix<W: Write>(
        list: &Vec<Self>,
        w: &mut W,
        scopes: &Vec<ScopeVar>,
    ) -> Result<(), TmplError> {
        if list.len() > 0 {
            let need_paren = list.len() > 1;
            write!(w, "!!")?;
            if need_paren {
                write!(w, "(")?;
            }
            for (i, this) in list.iter().enumerate() {
                if i > 0 {
                    write!(w, "||")?;
                }
                write!(w, "{}", this.to_path_analysis_str(scopes)?)?;
            }
            if need_paren {
                write!(w, ")")?;
            }
            write!(w, "||")?;
        }
        Ok(())
    }

    fn is_legal_lvalue_path(&self, scopes: &Vec<ScopeVar>, model: Option<bool>) -> bool {
        let mut iter = self.0.iter();
        match iter.next() {
            None => return false,
            Some(PathSlice::Ident(_)) => {
                if model == Some(false) { return false }
            }
            Some(PathSlice::ScopeIndex(i)) => {
                match &scopes[*i].lvalue_path {
                    ScopeVarLvaluePath::Invalid => return false,
                    ScopeVarLvaluePath::Var { from_data_scope, .. } => {
                        if let Some(model) = model {
                            if model && !*from_data_scope { return false }
                            if !model && *from_data_scope { return false }
                        }
                    }
                    ScopeVarLvaluePath::Script {..} | ScopeVarLvaluePath::InlineScript {..} => {
                        if model == Some(true) { return false }
                    }
                }
            }
            Some(PathSlice::Condition(_, (true_pas, _), (false_pas, _))) => {
                let true_br_res = if let PathAnalysisState::InPath(x) = true_pas {
                    x.is_legal_lvalue_path(scopes, model)
                } else {
                    false
                };
                let false_br_res = if let PathAnalysisState::InPath(x) = false_pas {
                    x.is_legal_lvalue_path(scopes, model)
                } else {
                    false
                };
                if !true_br_res && !false_br_res {
                    return false
                }
            }
            _ => return false,
        }
        // TODO split the first segment as another type to avoid this check
        for x in iter {
            match x {
                PathSlice::StaticMember(_) | PathSlice::IndirectValue(_) => {}
                _ => return false,
            }
        }
        true
    }

    fn to_lvalue_path_arr<W: Write>(
        &self,
        w: &mut JsExprWriter<W>,
        scopes: &Vec<ScopeVar>,
        model: Option<bool>,
    ) -> Result<(), TmplError> {
        let br = |w: &mut JsExprWriter<W>| -> Result<(), TmplError> {
            write!(w, "[")?;
            let mut write_items = || -> Result<bool, TmplError> {
                let mut iter = self.0.iter();
                let mut need_slice_1 = false;
                let mut need_comma = true;
                if model == Some(true) {
                    match iter.next() {
                        Some(PathSlice::Ident(s)) => write!(w, r#"{}"#, gen_lit_str(s))?,
                        Some(PathSlice::ScopeIndex(i)) => match &scopes[*i].lvalue_path {
                            ScopeVarLvaluePath::Var { var_name, from_data_scope } if *from_data_scope => {
                                write!(w, r#"...{}"#, var_name)?;
                                need_slice_1 = true;
                            }
                            _ => return Ok(false),
                        },
                        Some(PathSlice::Condition(..)) => {
                            need_comma = false;
                        }
                        _ => return Ok(false),
                    }
                } else {
                    match iter.next() {
                        Some(PathSlice::Ident(s)) => write!(w, r#"0,{}"#, gen_lit_str(s))?,
                        Some(PathSlice::ScopeIndex(i)) => match &scopes[*i].lvalue_path {
                            ScopeVarLvaluePath::Invalid => return Ok(false),
                            ScopeVarLvaluePath::Var { var_name, .. } => write!(w, r#"...{}"#, var_name)?,
                            ScopeVarLvaluePath::Script { abs_path } => write!(w, r#"1,{}"#, gen_lit_str(abs_path))?,
                            ScopeVarLvaluePath::InlineScript { path, mod_name } => write!(w, r#"2,{},{}"#, gen_lit_str(path), gen_lit_str(mod_name))?,
                        },
                        _ => return Ok(false),
                    }
                }
                for x in iter {
                    if need_comma {
                        write!(w, ",")?;
                    } else {
                        need_comma = true;
                    }
                    match x {
                        PathSlice::StaticMember(s) => write!(w, "{}", gen_lit_str(s))?,
                        PathSlice::IndirectValue(i) => write!(w, "{}", i)?,
                        _ => break,
                    }
                }
                Ok(need_slice_1)
            };
            let need_slice_1 = write_items()?;
            write!(w, "]")?;
            if need_slice_1 {
                write!(w, ".slice(1)")?;
            }
            Ok(())
        };
        if let Some(PathSlice::Condition(cond, (true_br, _), (false_br, _))) = self.0.first() {
            if self.0.len() == 1 {
                write!(w, r#"{}?"#, cond)?;
                true_br.write_lvalue_path(w, scopes, model)?;
                write!(w, r#":"#)?;
                false_br.write_lvalue_path(w, scopes, model)?;
            } else {
                write!(w, r#"{}?"#, cond)?;
                if true_br.write_lvalue_path(w, scopes, model)?.is_some() {
                    write!(w, r#".concat("#)?;
                    br(w)?;
                    write!(w, r#")"#)?;
                }
                write!(w, r#":"#)?;
                if false_br.write_lvalue_path(w, scopes, model)?.is_some() {
                    write!(w, r#".concat("#)?;
                    br(w)?;
                    write!(w, r#")"#)?;
                }
            }
        } else {
            br(w)?;
        }
        Ok(())
    }

    fn to_path_analysis_str(&self, scopes: &Vec<ScopeVar>) -> Result<String, TmplError> {
        let mut ret = String::new();
        for path_slice in self.0.iter() {
            match path_slice {
                PathSlice::Ident(s) => write!(&mut ret, "U.{}", s)?,
                PathSlice::ScopeIndex(i) => {
                    if let Some(x) = scopes[*i].update_path_tree.as_ref() {
                        write!(&mut ret, "{}", x)?
                    } else {
                        write!(&mut ret, "undefined")?
                    }
                },
                PathSlice::StaticMember(s) => {
                    ret = format!("Z({},{})", ret, gen_lit_str(s));
                }
                PathSlice::IndirectValue(i) => {
                    ret = format!("Z({},{})", ret, i);
                }
                PathSlice::CombineObj(v) => {
                    let mut s = String::new();
                    let mut prepend = String::new();
                    let mut need_object_assign = false;
                    let mut next_need_comma_sep = false;
                    for (key, sub_pas_str, sub_p) in v.iter() {
                        let mut sub_s = String::new();
                        let sub_pas_str =
                            sub_pas_str.to_path_analysis_str(sub_p, &mut sub_s, scopes)?;
                        if let Some(_) = sub_pas_str {
                            match key {
                                Some(key) => {
                                    if next_need_comma_sep {
                                        write!(s, ",")?;
                                    }
                                    write!(s, "{}:{}", key, sub_s)?;
                                    next_need_comma_sep = true;
                                }
                                None => {
                                    write!(prepend, "({})===true||", sub_s)?;
                                    write!(s, "}},X({}),{{", sub_s)?;
                                    need_object_assign = true;
                                    next_need_comma_sep = false;
                                }
                            }
                        }
                    }
                    if need_object_assign {
                        write!(ret, "{}Object.assign({{{}}})", prepend, s)?;
                    } else {
                        write!(ret, "{}{{{}}}", prepend, s)?;
                    }
                }
                PathSlice::CombineArr(v) => {
                    write!(ret, "[")?;
                    let mut next_need_comma_sep = false;
                    for (sub_pas, sub_p) in v.iter() {
                        let mut s = String::new();
                        let sub_pas_str = sub_pas.to_path_analysis_str(sub_p, &mut s, scopes)?;
                        if let Some(_) = sub_pas_str {
                            if next_need_comma_sep {
                                write!(ret, ",")?;
                            }
                            write!(ret, "{}", s)?;
                            next_need_comma_sep = true;
                        }
                    }
                    write!(ret, "]")?;
                }
                PathSlice::Condition(cond, (true_pas, true_p), (false_pas, false_p)) => {
                    write!(ret, "({}?", cond)?;
                    if true_pas.to_path_analysis_str(true_p, &mut ret, scopes)?.is_none() {
                        write!(ret, "undefined")?;
                    }
                    write!(ret, ":")?;
                    if false_pas.to_path_analysis_str(false_p, &mut ret, scopes)?.is_none() {
                        write!(ret, "undefined")?;
                    }
                    write!(ret, ")")?;
                }
            }
        }
        Ok(ret)
    }
}

#[derive(Debug)]
pub(crate) enum PathAnalysisState {
    InPath(PathSliceList),
    NotInPath,
}

impl PathAnalysisState {
    fn to_path_analysis_str<W: Write>(
        &self,
        sub_p: &Vec<PathSliceList>,
        w: &mut W,
        scopes: &Vec<ScopeVar>,
    ) -> Result<Option<()>, TmplError> {
        PathSliceList::to_path_analysis_str_group_prefix(&sub_p, w, scopes)?;
        let ret = match self {
            PathAnalysisState::InPath(path_slices) => {
                let s = path_slices.to_path_analysis_str(scopes)?;
                write!(w, "{}", s)?;
                Some(())
            }
            PathAnalysisState::NotInPath => {
                if sub_p.len() > 0 {
                    write!(w, "undefined")?;
                    Some(())
                } else {
                    None
                }
            }
        };
        Ok(ret)
    }

    fn write_lvalue_path<W: Write>(
        &self,
        w: &mut JsExprWriter<W>,
        scopes: &Vec<ScopeVar>,
        model: Option<bool>,
    ) -> Result<Option<()>, TmplError> {
        match &self {
            PathAnalysisState::InPath(psl) if psl.is_legal_lvalue_path(scopes, model) => {
                psl.to_lvalue_path_arr(w, scopes, model)?;
                Ok(Some(()))
            }
            _ => {
                write!(w, "null")?;
                Ok(None)
            }
        }
    }
}

impl TmplExpr {
    fn to_proc_gen_rec_and_end_path<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        allow_level: TmplExprLevel,
        path_calc: &mut Vec<PathSliceList>,
        value: &mut String,
    ) -> Result<(), TmplError> {
        let pas = self.to_proc_gen_rec(w, scopes, allow_level, path_calc, value)?;
        match pas {
            PathAnalysisState::InPath(path_slices) => {
                path_calc.push(path_slices);
            }
            PathAnalysisState::NotInPath => {}
        }
        Ok(())
    }

    fn to_proc_gen_rec_and_combine_paths<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        allow_level: TmplExprLevel,
        value: &mut String,
    ) -> Result<(PathAnalysisState, Vec<PathSliceList>), TmplError> {
        let mut path_calc = vec![];
        let pas = self.to_proc_gen_rec(w, scopes, allow_level, &mut path_calc, value)?;
        Ok((pas, path_calc))
    }

    fn to_proc_gen_rec<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        allow_level: TmplExprLevel,
        path_calc: &mut Vec<PathSliceList>,
        value: &mut String,
    ) -> Result<PathAnalysisState, TmplError> {
        if self.level() > allow_level {
            write!(value, "(")?;
            let ret = self.to_proc_gen_rec(w, scopes, TmplExprLevel::Comma, path_calc, value)?;
            write!(value, ")")?;
            return Ok(ret);
        }
        let path_analysis_state: PathAnalysisState = match self {
            TmplExpr::ScopeIndex(index) => {
                let scope = &scopes[*index];
                write!(value, "{}", scope.var)?;
                match scope.lvalue_path {
                    ScopeVarLvaluePath::Script { .. } | ScopeVarLvaluePath::InlineScript { .. } => {
                        PathAnalysisState::InPath(PathSliceList(vec![PathSlice::ScopeIndex(*index)]))
                    }
                    ScopeVarLvaluePath::Invalid | ScopeVarLvaluePath::Var { .. } => {
                        if scope.update_path_tree.is_some() {
                            PathAnalysisState::InPath(PathSliceList(vec![PathSlice::ScopeIndex(*index)]))
                        } else {
                            PathAnalysisState::NotInPath
                        }
                    }
                }
            }
            TmplExpr::Ident(x) => {
                write!(value, "D.{}", x)?;
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::Ident(x.clone())]))
            }
            TmplExpr::ToStringWithoutUndefined(x) => {
                write!(value, "Y(")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Cond, path_calc, value)?;
                write!(value, ")")?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::LitUndefined => {
                write!(value, "undefined")?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitNull => {
                write!(value, "null")?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitStr(x) => {
                write!(value, "{}", gen_lit_str(x))?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitInt(x) => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitFloat(x) => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitBool(x) => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LitObj(x) => {
                let mut s = String::new();
                let mut need_object_assign = false;
                let mut next_need_comma_sep = false;
                let mut sub_pas_list = Vec::with_capacity(x.len());
                for x in x.iter() {
                    match &x.0 {
                        Some(k) => {
                            if next_need_comma_sep {
                                write!(s, ",")?;
                            }
                            write!(s, "{}:", &k)?;
                            let (pas, sub_p) = x.1.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                TmplExprLevel::Cond,
                                &mut s,
                            )?;
                            next_need_comma_sep = true;
                            sub_pas_list.push((x.0.clone(), pas, sub_p));
                        }
                        None => {
                            write!(s, "}},X(")?;
                            let (pas, sub_p) = x.1.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                TmplExprLevel::Cond,
                                &mut s,
                            )?;
                            write!(s, "),{{")?;
                            need_object_assign = true;
                            next_need_comma_sep = false;
                            sub_pas_list.push((None, pas, sub_p));
                        }
                    }
                }
                if need_object_assign {
                    write!(value, "Object.assign({{{}}})", s)?;
                } else {
                    write!(value, "{{{}}}", s)?;
                }
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::CombineObj(sub_pas_list)]))
            }
            TmplExpr::LitArr(x) => {
                write!(value, "[")?;
                let mut sub_pas_list = Vec::with_capacity(x.len());
                for (i, x) in x.iter().enumerate() {
                    if i > 0 {
                        write!(value, ",")?;
                    }
                    let (pas, sub_p) =
                        x.to_proc_gen_rec_and_combine_paths(w, scopes, TmplExprLevel::Cond, value)?;
                    sub_pas_list.push((pas, sub_p));
                }
                write!(value, "]")?;
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::CombineArr(sub_pas_list)]))
            }

            TmplExpr::StaticMember(x, y) => {
                write!(value, "X(")?;
                let mut pas =
                    x.to_proc_gen_rec(w, scopes, TmplExprLevel::Cond, path_calc, value)?;
                write!(value, ").{}", y)?;
                match &mut pas {
                    PathAnalysisState::InPath(path_slices) => {
                        path_slices.0.push(PathSlice::StaticMember(y.clone()));
                    }
                    PathAnalysisState::NotInPath => {
                        // do nothing
                    }
                }
                pas
            }
            TmplExpr::DynamicMember(x, y) => {
                let ident = {
                    let ident = w.gen_private_ident();
                    let mut s = String::new();
                    y.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        TmplExprLevel::Cond,
                        path_calc,
                        &mut s,
                    )?;
                    w.expr_stmt(|w| {
                        write!(w, "var {}={}", ident, s)?;
                        Ok(())
                    })?;
                    ident
                };
                write!(value, "X(")?;
                let mut pas =
                    x.to_proc_gen_rec(w, scopes, TmplExprLevel::Cond, path_calc, value)?;
                write!(value, ")[{}]", ident)?;
                match &mut pas {
                    PathAnalysisState::InPath(path_slices) => {
                        path_slices.0.push(PathSlice::IndirectValue(ident));
                    }
                    PathAnalysisState::NotInPath => {
                        // do nothing
                    }
                }
                pas
            }
            TmplExpr::FuncCall(x, y) => {
                write!(value, "P(")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Cond, path_calc, value)?;
                write!(value, ")(")?;
                for (i, y) in y.iter().enumerate() {
                    if i > 0 {
                        write!(value, ",")?;
                    }
                    y.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        TmplExprLevel::Cond,
                        path_calc,
                        value,
                    )?;
                }
                write!(value, ")")?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::Reverse(x) => {
                write!(value, "!")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::BitReverse(x) => {
                write!(value, "~")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Positive(x) => {
                write!(value, "+")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Negative(x) => {
                write!(value, "-")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::TypeOf(x) => {
                write!(value, "typeof ")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Void(x) => {
                write!(value, "void ")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::Multiply(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "*")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Divide(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "/")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Mod(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "%")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Unary, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Plus(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                write!(value, "+")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Multiply,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Minus(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                write!(value, "-")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Multiply,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::Lt(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, "<")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Gt(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, ">")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Lte(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, "<=")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Gte(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, ">=")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Eq(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Eq, path_calc, value)?;
                write!(value, "==")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::Ne(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Eq, path_calc, value)?;
                write!(value, "!=")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::EqFull(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Eq, path_calc, value)?;
                write!(value, "===")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::NeFull(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Eq, path_calc, value)?;
                write!(value, "!==")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::BitAnd(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitAnd, path_calc, value)?;
                write!(value, "&")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::Eq, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::BitXor(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitOr, path_calc, value)?;
                write!(value, "^")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitAnd, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::BitOr(x, y) => {
                x.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitOr, path_calc, value)?;
                write!(value, "|")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitXor, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LogicAnd(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::LogicAnd,
                    path_calc,
                    value,
                )?;
                write!(value, "&&")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, TmplExprLevel::BitOr, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            TmplExpr::LogicOr(x, y) => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::LogicOr,
                    path_calc,
                    value,
                )?;
                write!(value, "||")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    TmplExprLevel::LogicAnd,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            TmplExpr::Cond(x, y, z) => {
                let ident = {
                    let ident = w.gen_private_ident();
                    let mut s = String::new();
                    x.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        TmplExprLevel::Cond,
                        path_calc,
                        &mut s,
                    )?;
                    w.expr_stmt(|w| {
                        write!(w, "var {}={}", ident, s)?;
                        Ok(())
                    })?;
                    ident
                };
                write!(value, "{}?", ident)?;
                let true_br = y.to_proc_gen_rec_and_combine_paths(w, scopes, TmplExprLevel::Cond, value)?;
                write!(value, ":")?;
                let false_br = z.to_proc_gen_rec_and_combine_paths(w, scopes, TmplExprLevel::Cond, value)?;
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::Condition(
                    ident,
                    true_br,
                    false_br,
                )]))
            }
        };
        Ok(path_analysis_state)
    }

    pub(crate) fn to_proc_gen_prepare<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
    ) -> Result<TmplExprProcGen, TmplError> {
        let mut value = String::new();
        let level = self.level();
        let (pas, sub_p) =
            self.to_proc_gen_rec_and_combine_paths(w, scopes, TmplExprLevel::Cond, &mut value)?;
        Ok(TmplExprProcGen { pas, sub_p, value, level })
    }

    // this function finds which keys can be put into the binding map,
    // and convert scope names to scope indexes at the same time.
    pub(crate) fn get_binding_map_keys(
        &mut self,
        bmc: &mut BindingMapCollector,
        scope_names: &Vec<String>,
        should_disable: bool,
    ) -> Option<BindingMapKeys> {
        let mut bmk = BindingMapKeys::new();
        self.get_binding_map_keys_rec(bmc, scope_names, should_disable, &mut bmk);
        if should_disable {
            None
        } else {
            Some(bmk)
        }
    }

    fn get_binding_map_keys_rec(
        &mut self,
        bmc: &mut BindingMapCollector,
        scope_names: &Vec<String>,
        should_disable: bool,
        bmk: &mut BindingMapKeys,
    ) {
        match self {
            TmplExpr::ScopeIndex(_) => {}
            TmplExpr::Ident(x) => {
                if let Some(n) = scope_names.iter().rposition(|n| n == x) {
                    *self = TmplExpr::ScopeIndex(n);
                } else if should_disable {
                    bmc.disable_field(x);
                } else if let Some(index) = bmc.add_field(x) {
                    bmk.add(x, index);
                }
            }
            TmplExpr::ToStringWithoutUndefined(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }

            TmplExpr::LitUndefined => {}
            TmplExpr::LitNull => {}
            TmplExpr::LitStr(_) => {}
            TmplExpr::LitInt(_) => {}
            TmplExpr::LitFloat(_) => {}
            TmplExpr::LitBool(_) => {}
            TmplExpr::LitObj(x) => {
                for x in x.iter_mut() {
                    x.1.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                }
            }
            TmplExpr::LitArr(x) => {
                for x in x.iter_mut() {
                    x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                }
            }

            TmplExpr::StaticMember(x, _) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::DynamicMember(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::FuncCall(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                for y in y.iter_mut() {
                    y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                }
            }

            TmplExpr::Reverse(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::BitReverse(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Positive(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Negative(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::TypeOf(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Void(x) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }

            TmplExpr::Multiply(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Divide(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Mod(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Plus(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Minus(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }

            TmplExpr::Lt(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Gt(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Lte(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Gte(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Eq(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::Ne(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::EqFull(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::NeFull(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }

            TmplExpr::BitAnd(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::BitXor(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::BitOr(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::LogicAnd(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
            TmplExpr::LogicOr(x, y) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }

            TmplExpr::Cond(x, y, z) => {
                x.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                y.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
                z.get_binding_map_keys_rec(bmc, scope_names, should_disable, bmk);
            }
        };
    }
}

impl fmt::Display for TmplExpr {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.to_expr_string(TmplExprLevel::Comma, false))
    }
}

pub(crate) struct TmplExprProcGen {
    pas: PathAnalysisState,
    sub_p: Vec<PathSliceList>,
    value: String,
    level: TmplExprLevel,
}

impl TmplExprProcGen {
    pub(crate) fn has_model_lvalue_path(&self, scopes: &Vec<ScopeVar>) -> bool {
        if let PathAnalysisState::InPath(psl) = &self.pas {
            psl.is_legal_lvalue_path(scopes, Some(true))
        } else {
            false
        }
    }

    pub(crate) fn has_script_lvalue_path(&self, scopes: &Vec<ScopeVar>) -> bool {
        if let PathAnalysisState::InPath(psl) = &self.pas {
            psl.is_legal_lvalue_path(scopes, Some(false))
        } else {
            false
        }
    }

    #[allow(dead_code)]
    pub(crate) fn has_general_lvalue_path(&self, scopes: &Vec<ScopeVar>) -> bool {
        if let PathAnalysisState::InPath(psl) = &self.pas {
            psl.is_legal_lvalue_path(scopes, None)
        } else {
            false
        }
    }

    pub(crate) fn lvalue_path<W: Write>(
        &self,
        w: &mut JsExprWriter<W>,
        scopes: &Vec<ScopeVar>,
        model: Option<bool>,
    ) -> Result<(), TmplError> {
        self.pas.write_lvalue_path(w, scopes, model)?;
        Ok(())
    }

    pub(crate) fn lvalue_state_expr<W: Write>(
        &self,
        w: &mut JsExprWriter<W>,
        scopes: &Vec<ScopeVar>,
    ) -> Result<(), TmplError> {
        let pas_str = self.pas.to_path_analysis_str(&self.sub_p, w, scopes)?;
        if let Some(_) = pas_str {
            // empty
        } else {
            write!(w, "undefined")?;
        }
        Ok(())
    }

    pub(crate) fn value_expr<W: Write>(&self, w: &mut JsExprWriter<W>) -> Result<(), TmplError> {
        write!(w, "{}", self.value)?;
        Ok(())
    }

    pub(crate) fn above_cond_expr(&self) -> bool {
        self.level >= TmplExprLevel::Cond
    }
}

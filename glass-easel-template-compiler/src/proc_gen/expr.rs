use std::fmt::Write;

use compact_str::CompactString;

use super::{JsExprWriter, JsFunctionScopeWriter, JsIdent, ScopeVar, ScopeVarLvaluePath};
use crate::{
    escape::gen_lit_str,
    parse::expr::{ArrayFieldKind, Expression, ObjectFieldKind},
    stringify::expr::ExpressionLevel,
    TmplError,
};

#[must_use]
#[derive(Debug)]
pub(crate) enum PathSlice {
    Ident(CompactString),
    ScopeIndex(usize),
    StaticMember(CompactString),
    IndirectValue(JsIdent),
    CombineObj(Vec<(Option<CompactString>, PathAnalysisState, Vec<PathSliceList>)>),
    CombineArr(
        Vec<(PathAnalysisState, Vec<PathSliceList>)>,
        Vec<(PathAnalysisState, Vec<PathSliceList>)>,
    ),
    Condition(
        JsIdent,
        (PathAnalysisState, Vec<PathSliceList>),
        (PathAnalysisState, Vec<PathSliceList>),
    ),
}

#[derive(Debug)]
pub(crate) struct PathSliceList(Vec<PathSlice>);

impl PathSliceList {
    fn to_path_analysis_str_group_prefix<W: Write>(
        list: &Vec<Self>,
        w: &mut W,
        scopes: &Vec<ScopeVar>,
        is_template_data: bool,
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
                write!(
                    w,
                    "{}",
                    this.to_path_analysis_str(scopes, is_template_data)?
                )?;
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
                if model == Some(false) {
                    return false;
                }
            }
            Some(PathSlice::ScopeIndex(i)) => match &scopes[*i].lvalue_path {
                ScopeVarLvaluePath::Invalid => return false,
                ScopeVarLvaluePath::Var {
                    from_data_scope, ..
                } => {
                    if let Some(model) = model {
                        if model && !*from_data_scope {
                            return false;
                        }
                        if !model && *from_data_scope {
                            return false;
                        }
                    }
                }
                ScopeVarLvaluePath::Script { .. } | ScopeVarLvaluePath::InlineScript { .. } => {
                    if model == Some(true) {
                        return false;
                    }
                }
            },
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
                    return false;
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
                            ScopeVarLvaluePath::Var {
                                var_name,
                                from_data_scope,
                            } if *from_data_scope => {
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
                            ScopeVarLvaluePath::Var { var_name, .. } => {
                                write!(w, r#"...{}"#, var_name)?
                            }
                            ScopeVarLvaluePath::Script { abs_path } => {
                                write!(w, r#"1,{}"#, gen_lit_str(abs_path))?
                            }
                            ScopeVarLvaluePath::InlineScript { path, mod_name } => {
                                write!(w, r#"2,{},{}"#, gen_lit_str(path), gen_lit_str(mod_name))?
                            }
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

    fn to_path_analysis_str(
        &self,
        scopes: &Vec<ScopeVar>,
        is_template_data: bool,
    ) -> Result<String, TmplError> {
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
                }
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
                        let sub_pas_str = sub_pas_str.to_path_analysis_str(
                            sub_p,
                            &mut sub_s,
                            scopes,
                            is_template_data,
                        )?;
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
                    if is_template_data {
                        if need_object_assign {
                            write!(ret, "{}Object.assign({{{}}})", prepend, s)?;
                        } else {
                            write!(ret, "{}{{{}}}", prepend, s)?;
                        }
                    } else {
                        if need_object_assign {
                            write!(ret, "{}Q.b(Object.assign({{{}}}))", prepend, s)?;
                        } else {
                            write!(ret, "{}Q.b({{{}}})", prepend, s)?;
                        }
                    }
                }
                PathSlice::CombineArr(v, spread) => {
                    for (sub_pas, sub_p) in spread.iter() {
                        let mut sub_s = String::new();
                        let sub_pas_str = sub_pas.to_path_analysis_str(
                            sub_p,
                            &mut sub_s,
                            scopes,
                            is_template_data,
                        )?;
                        if let Some(_) = sub_pas_str {
                            write!(ret, "({})!==undefined||", sub_s)?;
                        }
                    }
                    write!(ret, "Q.a([")?;
                    let mut next_need_comma_sep = false;
                    for (sub_pas, sub_p) in v.iter() {
                        if next_need_comma_sep {
                            write!(ret, ",")?;
                        }
                        let mut s = String::new();
                        let sub_pas_str = sub_pas.to_path_analysis_str(
                            sub_p,
                            &mut s,
                            scopes,
                            is_template_data,
                        )?;
                        if let Some(_) = sub_pas_str {
                            write!(ret, "{}", s)?;
                            next_need_comma_sep = true;
                        }
                    }
                    write!(ret, "])")?;
                }
                PathSlice::Condition(cond, (true_pas, true_p), (false_pas, false_p)) => {
                    write!(ret, "({}?", cond)?; // FIXME `cond` itself should calc its path slices?
                    if true_pas
                        .to_path_analysis_str(true_p, &mut ret, scopes, is_template_data)?
                        .is_none()
                    {
                        write!(ret, "undefined")?;
                    }
                    write!(ret, ":")?;
                    if false_pas
                        .to_path_analysis_str(false_p, &mut ret, scopes, is_template_data)?
                        .is_none()
                    {
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
        is_template_data: bool,
    ) -> Result<Option<()>, TmplError> {
        PathSliceList::to_path_analysis_str_group_prefix(&sub_p, w, scopes, is_template_data)?;
        let ret = match self {
            PathAnalysisState::InPath(path_slices) => {
                let s = path_slices.to_path_analysis_str(scopes, is_template_data)?;
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

impl Expression {
    fn to_proc_gen_rec_and_end_path<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
        allow_level: ExpressionLevel,
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
        allow_level: ExpressionLevel,
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
        allow_level: ExpressionLevel,
        path_calc: &mut Vec<PathSliceList>,
        value: &mut String,
    ) -> Result<PathAnalysisState, TmplError> {
        if proc_gen_expression_level(self) > allow_level {
            write!(value, "(")?;
            let ret = self.to_proc_gen_rec(w, scopes, ExpressionLevel::Cond, path_calc, value)?;
            write!(value, ")")?;
            return Ok(ret);
        }
        let path_analysis_state: PathAnalysisState = match self {
            Expression::ScopeRef { index, .. } => {
                let scope = &scopes[*index];
                write!(value, "{}", scope.var)?;
                match scope.lvalue_path {
                    ScopeVarLvaluePath::Script { .. } | ScopeVarLvaluePath::InlineScript { .. } => {
                        PathAnalysisState::InPath(PathSliceList(vec![PathSlice::ScopeIndex(
                            *index,
                        )]))
                    }
                    ScopeVarLvaluePath::Invalid | ScopeVarLvaluePath::Var { .. } => {
                        if scope.update_path_tree.is_some() {
                            PathAnalysisState::InPath(PathSliceList(vec![PathSlice::ScopeIndex(
                                *index,
                            )]))
                        } else {
                            PathAnalysisState::NotInPath
                        }
                    }
                }
            }
            Expression::DataField { name: x, .. } => {
                write!(value, "D.{}", x)?;
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::Ident(x.clone())]))
            }
            Expression::ToStringWithoutUndefined { value: x, .. } => {
                write!(value, "Y(")?;
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Cond, path_calc, value)?;
                write!(value, ")")?;
                PathAnalysisState::NotInPath
            }

            Expression::LitUndefined { .. } => {
                write!(value, "undefined")?;
                PathAnalysisState::NotInPath
            }
            Expression::LitNull { .. } => {
                write!(value, "null")?;
                PathAnalysisState::NotInPath
            }
            Expression::LitStr { value: x, .. } => {
                write!(value, "{}", gen_lit_str(x))?;
                PathAnalysisState::NotInPath
            }
            Expression::LitInt { value: x, .. } => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            Expression::LitFloat { value: x, .. } => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            Expression::LitBool { value: x, .. } => {
                write!(value, "{}", x)?;
                PathAnalysisState::NotInPath
            }
            Expression::LitObj { fields: x, .. } => {
                let mut s = String::new();
                let mut need_object_assign = false;
                let mut next_need_comma_sep = false;
                let mut sub_pas_list = Vec::with_capacity(x.len());
                for x in x.iter() {
                    match x {
                        ObjectFieldKind::Named { name, value, .. } => {
                            if next_need_comma_sep {
                                write!(s, ",")?;
                            }
                            write!(s, "{}:", &name)?;
                            let (pas, sub_p) = value.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                ExpressionLevel::Cond,
                                &mut s,
                            )?;
                            next_need_comma_sep = true;
                            sub_pas_list.push((Some(name.clone()), pas, sub_p));
                        }
                        ObjectFieldKind::Spread { value, .. } => {
                            write!(s, "}},X(")?;
                            let (pas, sub_p) = value.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                ExpressionLevel::Cond,
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
            Expression::LitArr { fields: x, .. } => {
                let mut s = String::new();
                let mut need_array_concat = false;
                let mut next_need_comma_sep = false;
                let mut sub_pas_list = Vec::with_capacity(x.len());
                let mut spread_sub_pas_list = Vec::with_capacity(x.len());
                for x in x.iter() {
                    match x {
                        ArrayFieldKind::Normal { value } => {
                            if next_need_comma_sep {
                                write!(s, ",")?;
                            }
                            let (pas, sub_p) = value.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                ExpressionLevel::Cond,
                                &mut s,
                            )?;
                            next_need_comma_sep = true;
                            let list = if spread_sub_pas_list.len() > 0 {
                                &mut spread_sub_pas_list
                            } else {
                                &mut sub_pas_list
                            };
                            list.push((pas, sub_p));
                        }
                        ArrayFieldKind::Spread { value, .. } => {
                            write!(s, "],")?;
                            let (pas, sub_p) = value.to_proc_gen_rec_and_combine_paths(
                                w,
                                scopes,
                                ExpressionLevel::Cond,
                                &mut s,
                            )?;
                            write!(s, ",[")?;
                            need_array_concat = true;
                            next_need_comma_sep = false;
                            spread_sub_pas_list.push((pas, sub_p));
                        }
                        ArrayFieldKind::EmptySlot => {
                            if next_need_comma_sep {
                                write!(s, ",")?;
                            }
                            write!(s, ",")?;
                            next_need_comma_sep = false;
                            let list = if spread_sub_pas_list.len() > 0 {
                                &mut spread_sub_pas_list
                            } else {
                                &mut sub_pas_list
                            };
                            list.push((PathAnalysisState::NotInPath, vec![]));
                        }
                    }
                }
                if need_array_concat {
                    write!(value, "[].concat([{}])", s)?;
                } else {
                    write!(value, "[{}]", s)?;
                }
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::CombineArr(
                    sub_pas_list,
                    spread_sub_pas_list,
                )]))
            }

            Expression::StaticMember {
                obj, field_name, ..
            } => {
                write!(value, "X(")?;
                let mut pas =
                    obj.to_proc_gen_rec(w, scopes, ExpressionLevel::Cond, path_calc, value)?;
                write!(value, ").{}", field_name)?;
                match &mut pas {
                    PathAnalysisState::InPath(path_slices) => {
                        path_slices
                            .0
                            .push(PathSlice::StaticMember(field_name.clone()));
                    }
                    PathAnalysisState::NotInPath => {
                        // do nothing
                    }
                }
                pas
            }
            Expression::DynamicMember {
                obj, field_name, ..
            } => {
                let ident = {
                    let ident = w.gen_private_ident();
                    let mut s = String::new();
                    field_name.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        ExpressionLevel::Cond,
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
                    obj.to_proc_gen_rec(w, scopes, ExpressionLevel::Cond, path_calc, value)?;
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
            Expression::FuncCall { func, args, .. } => {
                write!(value, "P(")?;
                func.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Cond,
                    path_calc,
                    value,
                )?;
                write!(value, ")(")?;
                for (i, y) in args.iter().enumerate() {
                    if i > 0 {
                        write!(value, ",")?;
                    }
                    y.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        ExpressionLevel::Cond,
                        path_calc,
                        value,
                    )?;
                }
                write!(value, ")")?;
                PathAnalysisState::NotInPath
            }

            Expression::Reverse { value: x, .. } => {
                write!(value, "!")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::BitReverse { value: x, .. } => {
                write!(value, "~")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Positive { value: x, .. } => {
                write!(value, " +")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Negative { value: x, .. } => {
                write!(value, " -")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::TypeOf { value: x, .. } => {
                write!(value, " typeof ")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Void { value: x, .. } => {
                write!(value, " void ")?;
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            Expression::Multiply {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "*")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Divide {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "/")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Remainer {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Multiply,
                    path_calc,
                    value,
                )?;
                write!(value, "%")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Unary,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Plus {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Plus, path_calc, value)?;
                write!(value, "+")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Multiply,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Minus {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Plus, path_calc, value)?;
                write!(value, "-")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Multiply,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            Expression::LeftShift {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                write!(value, "<<")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            Expression::RightShift {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                write!(value, ">>")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            Expression::UnsignedRightShift {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                write!(value, ">>>")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Plus, path_calc, value)?;
                PathAnalysisState::NotInPath
            }

            Expression::Lt {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, "<")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Gt {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, ">")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Lte {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, "<=")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Gte {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, ">=")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::InstanceOf {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                write!(value, " instanceof ")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Shift,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Eq {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Eq, path_calc, value)?;
                write!(value, "==")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::Ne {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Eq, path_calc, value)?;
                write!(value, "!=")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::EqFull {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Eq, path_calc, value)?;
                write!(value, "===")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::NeFull {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Eq, path_calc, value)?;
                write!(value, "!==")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::Comparison,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }

            Expression::BitAnd {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitAnd,
                    path_calc,
                    value,
                )?;
                write!(value, "&")?;
                y.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Eq, path_calc, value)?;
                PathAnalysisState::NotInPath
            }
            Expression::BitXor {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitOr,
                    path_calc,
                    value,
                )?;
                write!(value, "^")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitAnd,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::BitOr {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitOr,
                    path_calc,
                    value,
                )?;
                write!(value, "|")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitXor,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::LogicAnd {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::LogicAnd,
                    path_calc,
                    value,
                )?;
                write!(value, "&&")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::BitOr,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::LogicOr {
                left: x, right: y, ..
            } => {
                x.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::LogicOr,
                    path_calc,
                    value,
                )?;
                write!(value, "||")?;
                y.to_proc_gen_rec_and_end_path(
                    w,
                    scopes,
                    ExpressionLevel::LogicAnd,
                    path_calc,
                    value,
                )?;
                PathAnalysisState::NotInPath
            }
            Expression::NullishCoalescing {
                left: x, right: y, ..
            } => {
                let ident = {
                    let ident = w.gen_private_ident();
                    let mut s = String::new();
                    x.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        ExpressionLevel::Cond,
                        path_calc,
                        &mut s,
                    )?;
                    w.expr_stmt(|w| {
                        write!(w, "var {}={}", ident, s)?;
                        Ok(())
                    })?;
                    ident
                };
                write!(value, "{ident}?{ident}:", ident = ident)?;
                y.to_proc_gen_rec_and_end_path(w, scopes, ExpressionLevel::Cond, path_calc, value)?;
                PathAnalysisState::NotInPath
            }

            Expression::Cond {
                cond,
                true_br,
                false_br,
                ..
            } => {
                let ident = {
                    let ident = w.gen_private_ident();
                    let mut s = String::new();
                    cond.to_proc_gen_rec_and_end_path(
                        w,
                        scopes,
                        ExpressionLevel::Cond,
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
                let true_br = true_br.to_proc_gen_rec_and_combine_paths(
                    w,
                    scopes,
                    ExpressionLevel::Cond,
                    value,
                )?;
                write!(value, ":")?;
                let false_br = false_br.to_proc_gen_rec_and_combine_paths(
                    w,
                    scopes,
                    ExpressionLevel::Cond,
                    value,
                )?;
                PathAnalysisState::InPath(PathSliceList(vec![PathSlice::Condition(
                    ident, true_br, false_br,
                )]))
            }
        };
        Ok(path_analysis_state)
    }

    pub(crate) fn to_proc_gen_prepare<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        scopes: &Vec<ScopeVar>,
    ) -> Result<ExpressionProcGen, TmplError> {
        let mut value = String::new();
        let level = ExpressionLevel::from_expression(self);
        let (pas, sub_p) =
            self.to_proc_gen_rec_and_combine_paths(w, scopes, ExpressionLevel::Cond, &mut value)?;
        Ok(ExpressionProcGen {
            pas,
            sub_p,
            value,
            level,
        })
    }
}

pub(crate) struct ExpressionProcGen {
    pas: PathAnalysisState,
    sub_p: Vec<PathSliceList>,
    value: String,
    level: ExpressionLevel,
}

impl ExpressionProcGen {
    pub(crate) fn is_lvalue_path_from_data_scope(&self, scopes: &Vec<ScopeVar>) -> Option<bool> {
        let has_model_lvalue_path = self.has_model_lvalue_path(scopes);
        let has_script_lvalue_path = self.has_script_lvalue_path(scopes);
        if has_model_lvalue_path && has_script_lvalue_path {
            // simply drop it if we cannot decide it is script or not
            // this may happens when conditional expression is used
            None
        } else if has_model_lvalue_path {
            Some(true)
        } else if has_script_lvalue_path {
            Some(false)
        } else {
            None
        }
    }

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
        is_template_data: bool,
    ) -> Result<(), TmplError> {
        let pas_str = self
            .pas
            .to_path_analysis_str(&self.sub_p, w, scopes, is_template_data)?;
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
        self.level >= ExpressionLevel::Cond
    }
}

fn proc_gen_expression_level(expr: &Expression) -> ExpressionLevel {
    match expr {
        Expression::ScopeRef { .. } => ExpressionLevel::Lit,
        Expression::DataField { .. } => ExpressionLevel::Member,
        Expression::ToStringWithoutUndefined { .. } => ExpressionLevel::Member,
        Expression::LitUndefined { .. } => ExpressionLevel::Lit,
        Expression::LitNull { .. } => ExpressionLevel::Lit,
        Expression::LitStr { .. } => ExpressionLevel::Lit,
        Expression::LitInt { .. } => ExpressionLevel::Lit,
        Expression::LitFloat { .. } => ExpressionLevel::Lit,
        Expression::LitBool { .. } => ExpressionLevel::Lit,
        Expression::LitObj { .. } => ExpressionLevel::Member,
        Expression::LitArr { .. } => ExpressionLevel::Member,
        Expression::StaticMember { .. } => ExpressionLevel::Member,
        Expression::DynamicMember { .. } => ExpressionLevel::Member,
        Expression::FuncCall { .. } => ExpressionLevel::Member,
        Expression::Reverse { .. } => ExpressionLevel::Unary,
        Expression::BitReverse { .. } => ExpressionLevel::Unary,
        Expression::Positive { .. } => ExpressionLevel::Unary,
        Expression::Negative { .. } => ExpressionLevel::Unary,
        Expression::TypeOf { .. } => ExpressionLevel::Unary,
        Expression::Void { .. } => ExpressionLevel::Unary,
        Expression::Multiply { .. } => ExpressionLevel::Multiply,
        Expression::Divide { .. } => ExpressionLevel::Multiply,
        Expression::Remainer { .. } => ExpressionLevel::Multiply,
        Expression::Plus { .. } => ExpressionLevel::Plus,
        Expression::Minus { .. } => ExpressionLevel::Plus,
        Expression::LeftShift { .. } => ExpressionLevel::Shift,
        Expression::RightShift { .. } => ExpressionLevel::Shift,
        Expression::UnsignedRightShift { .. } => ExpressionLevel::Shift,
        Expression::Lt { .. } => ExpressionLevel::Comparison,
        Expression::Gt { .. } => ExpressionLevel::Comparison,
        Expression::Lte { .. } => ExpressionLevel::Comparison,
        Expression::Gte { .. } => ExpressionLevel::Comparison,
        Expression::InstanceOf { .. } => ExpressionLevel::Comparison,
        Expression::Eq { .. } => ExpressionLevel::Eq,
        Expression::Ne { .. } => ExpressionLevel::Eq,
        Expression::EqFull { .. } => ExpressionLevel::Eq,
        Expression::NeFull { .. } => ExpressionLevel::Eq,
        Expression::BitAnd { .. } => ExpressionLevel::BitAnd,
        Expression::BitXor { .. } => ExpressionLevel::BitXor,
        Expression::BitOr { .. } => ExpressionLevel::BitOr,
        Expression::LogicAnd { .. } => ExpressionLevel::LogicAnd,
        Expression::LogicOr { .. } => ExpressionLevel::LogicOr,
        Expression::NullishCoalescing { .. } => ExpressionLevel::Cond,
        Expression::Cond { .. } => ExpressionLevel::Cond,
    }
}

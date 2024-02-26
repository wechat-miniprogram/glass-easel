//! The basic parser logic

use pest::{Parser, Position};
use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;

use crate::binding_map::BindingMapCollector;

use super::*;

#[derive(Parser)]
#[grammar = "tmpl.pest"]
struct TmplParser;

/// Template parsing error object.
pub struct TmplParseError {
    pub message: String,
    pub filename: String,
    pub start_pos: (usize, usize),
    pub end_pos: (usize, usize),
}

impl fmt::Debug for TmplParseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "Template parsing error (at {}:{}:{}): {}",
            self.filename, self.start_pos.0, self.start_pos.1, self.message
        )
    }
}

impl fmt::Display for TmplParseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for TmplParseError {}

enum TextEntity<U> {
    Static(U),
    Dynamic(Box<TmplExpr>),
}

pub struct TmplParseTask<'a> {
    pub tmpl_str: &'a str,
    pub path: &'a str,
}

impl<'a> TmplParseTask<'a> {
    pub fn new(tmpl_str: &'a str, path: &'a str) -> Self {
        TmplParseTask { tmpl_str, path }
    }

    fn raise_error<R>(self: &Self, message: &str, loc: &TmplLocation) -> Result<R, TmplParseError> {
        Err(TmplParseError {
            message: message.to_string(),
            filename: self.path.to_string(),
            start_pos: Position::new(self.tmpl_str, loc.start).unwrap().line_col(),
            end_pos: Position::new(self.tmpl_str, loc.end).unwrap().line_col(),
        })
    }

    fn parse_expr_or_obj(self: &Self, pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
        fn parse_ident_or_keyword(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let name = pair.as_str();
            match name {
                "undefined" => Box::new(TmplExpr::LitUndefined),
                "null" => Box::new(TmplExpr::LitNull),
                "true" => Box::new(TmplExpr::LitBool(true)),
                "false" => Box::new(TmplExpr::LitBool(false)),
                x => Box::new(TmplExpr::Ident(x.to_string())),
            }
        }
        fn parse_str_content(pair: pest::iterators::Pair<'_, Rule>) -> String {
            let pairs = pair.into_inner();
            pairs
                .map(|pair| match pair.as_rule() {
                    Rule::lit_str_escaped => {
                        let s = pair.as_str();
                        let c = match &s[1..2] {
                            "r" => '\r',
                            "n" => '\n',
                            "t" => '\t',
                            "b" => '\x08',
                            "f" => '\x0C',
                            "v" => '\x0B',
                            "0" => '\0',
                            "'" => '\'',
                            "\"" => '"',
                            "x" | "u" => {
                                std::char::from_u32(s[2..].parse::<u32>().unwrap()).unwrap_or('\0')
                            }
                            _ => s.chars().nth(1).unwrap(),
                        };
                        c.to_string()
                    }
                    _ => pair.as_str().to_string(),
                })
                .collect()
        }
        fn parse_str(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            Box::new(TmplExpr::LitStr(parse_str_content(pair)))
        }
        fn parse_number(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let mut pairs = pair.into_inner();
            let main = pairs.next().unwrap();
            let num = match main.as_rule() {
                Rule::lit_number_hex => {
                    TmplExpr::LitInt(i32::from_str_radix(main.as_str(), 16).unwrap_or(0))
                }
                Rule::lit_number_oct => {
                    TmplExpr::LitInt(i32::from_str_radix(main.as_str(), 8).unwrap_or(0))
                }
                Rule::lit_number_dec => {
                    if let Some(next) = pairs.next() {
                        let mut s = main.as_str().to_string() + next.as_str();
                        if let Some(next) = pairs.next() {
                            s += next.as_str()
                        }
                        TmplExpr::LitFloat(s.parse::<f64>().unwrap_or(0.))
                    } else {
                        TmplExpr::LitInt(i32::from_str_radix(main.as_str(), 10).unwrap_or(0))
                    }
                }
                _ => unreachable!(),
            };
            Box::new(num)
        }
        fn parse_obj(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let pairs = pair.into_inner();
            let obj = pairs
                .map(|x| {
                    let mut pairs = x.into_inner();
                    let pair = pairs.next().unwrap();
                    let k: Option<String> = match pair.as_rule() {
                        Rule::ident => Some(pair.as_str().to_string()),
                        Rule::lit_str => Some(parse_str_content(pair)),
                        Rule::spread => None,
                        _ => unreachable!(),
                    };
                    let v = if let Some(x) = pairs.next() {
                        *parse_cond(x)
                    } else {
                        TmplExpr::Ident(k.clone().unwrap())
                    };
                    (k, v)
                })
                .collect();
            Box::new(TmplExpr::LitObj(obj))
        }
        fn parse_arr(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let pairs = pair.into_inner();
            let arr = pairs.map(|x| *parse_cond(x)).collect();
            Box::new(TmplExpr::LitArr(arr))
        }
        fn parse_value(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let pair = pair.into_inner().next().unwrap();
            match pair.as_rule() {
                Rule::cond => parse_cond(pair),
                Rule::lit_str => parse_str(pair),
                Rule::lit_number => parse_number(pair),
                Rule::lit_obj => parse_obj(pair),
                Rule::lit_arr => parse_arr(pair),
                Rule::ident => parse_ident_or_keyword(pair),
                _ => unreachable!(),
            }
        }

        fn parse_member(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let mut pairs = pair.into_inner();
            let mut ret = parse_value(pairs.next().unwrap());
            while let Some(op) = pairs.next() {
                match op.as_rule() {
                    Rule::static_member => {
                        let next = op.into_inner().next().unwrap();
                        ret = Box::new(TmplExpr::StaticMember(ret, next.as_str().to_string()))
                    }
                    Rule::dynamic_member => {
                        let next = parse_cond(op.into_inner().next().unwrap());
                        ret = Box::new(TmplExpr::DynamicMember(ret, next))
                    }
                    Rule::func_call => {
                        let next = op.into_inner().map(|next| *parse_cond(next)).collect();
                        ret = Box::new(TmplExpr::FuncCall(ret, next))
                    }
                    _ => unreachable!(),
                }
            }
            ret
        }
        fn parse_unary(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let mut pairs = pair.into_inner();
            let op = pairs.next().unwrap();
            if op.as_rule() == Rule::member {
                return parse_member(op);
            }
            let next = parse_unary(pairs.next().unwrap());
            let ret = Box::new(match op.as_rule() {
                Rule::reverse => TmplExpr::Reverse(next),
                Rule::bit_reverse => TmplExpr::BitReverse(next),
                Rule::positive => TmplExpr::Positive(next),
                Rule::negative => TmplExpr::Negative(next),
                Rule::type_of => TmplExpr::TypeOf(next),
                Rule::void => TmplExpr::Void(next),
                _ => unreachable!(),
            });
            ret
        }

        macro_rules! parse_common_op {
            ($cur:ident, $child:ident, { $($rule:ident: $t:ident),* }) => {
                fn $cur(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
                    let mut pairs = pair.into_inner();
                    let mut ret = $child(pairs.next().unwrap());
                    while let Some(op) = pairs.next() {
                        let next = $child(pairs.next().unwrap());
                        ret = Box::new(match op.as_rule() {
                            $(Rule::$rule => TmplExpr::$t(ret, next),)*
                            _ => unreachable!()
                        });
                    }
                    ret
                }
            }
        }
        parse_common_op!(parse_multi, parse_unary, {
            multi: Multiply,
            div: Divide,
            rem: Mod
        });
        parse_common_op!(parse_plus, parse_multi, {
            plus: Plus,
            minus: Minus
        });
        parse_common_op!(parse_cmp, parse_plus, {
            lt: Lt,
            gt: Gt,
            lte: Lte,
            gte: Gte
        });
        parse_common_op!(parse_eq, parse_cmp, {
            eq: Eq,
            ne: Ne,
            eq_full: EqFull,
            ne_full: NeFull
        });
        parse_common_op!(parse_bit_and, parse_eq, { bit_and: BitAnd });
        parse_common_op!(parse_bit_xor, parse_bit_and, { bit_xor: BitXor });
        parse_common_op!(parse_bit_or, parse_bit_xor, { bit_or: BitOr });
        parse_common_op!(parse_and, parse_bit_or, { and: LogicAnd });
        parse_common_op!(parse_or, parse_and, { or: LogicOr });

        fn parse_cond(pair: pest::iterators::Pair<'_, Rule>) -> Box<TmplExpr> {
            let mut pairs = pair.into_inner();
            let mut ret = parse_or(pairs.next().unwrap());
            if let Some(true_pair) = pairs.next() {
                let false_pair = pairs.next().unwrap();
                ret = Box::new(TmplExpr::Cond(
                    ret,
                    parse_cond(true_pair),
                    parse_cond(false_pair),
                ))
            }
            ret
        }

        let pair = pair.into_inner().next().unwrap();
        match pair.as_rule() {
            Rule::cond => parse_cond(pair),
            Rule::obj_body => parse_obj(pair),
            _ => unreachable!(),
        }
    }

    fn parse_text_entity(self: &Self, pair: pest::iterators::Pair<'_, Rule>) -> TextEntity<String> {
        let mut is_dynamic = false;
        let segs: Vec<TextEntity<Cow<str>>> = pair
            .into_inner()
            .map(|pair| {
                let pair = pair.into_inner().next().unwrap();
                match pair.as_rule() {
                    Rule::expr_or_obj => {
                        is_dynamic = true;
                        TextEntity::Dynamic(self.parse_expr_or_obj(pair))
                    }
                    Rule::entity => TextEntity::Static(entities::decode(pair.as_str())),
                    Rule::pure_text => TextEntity::Static(Cow::Borrowed(pair.as_str())),
                    _ => unreachable!(),
                }
            })
            .collect();
        let has_multi_segs = segs.len() > 1;
        if is_dynamic {
            let mut segs = segs.into_iter();
            let mut cur = match segs.next().unwrap() {
                TextEntity::Static(s) => Box::new(TmplExpr::LitStr(s.to_string().into())),
                TextEntity::Dynamic(expr) => {
                    if has_multi_segs {
                        Box::new(TmplExpr::ToStringWithoutUndefined(expr))
                    } else {
                        expr
                    }
                }
            };
            for seg in segs {
                if let TextEntity::Static(dest) = &seg {
                    if let TmplExpr::Plus(_, cur) = &mut *cur {
                        if let TmplExpr::LitStr(src) = &mut **cur {
                            **cur = TmplExpr::LitStr((src.clone() + &dest).into());
                            continue;
                        }
                    } else if let TmplExpr::LitStr(src) = &mut *cur {
                        *cur = TmplExpr::LitStr((src.clone() + &dest).into());
                        continue;
                    }
                }
                let next = match seg {
                    TextEntity::Static(s) => Box::new(TmplExpr::LitStr(s.to_string().into())),
                    TextEntity::Dynamic(expr) => {
                        if has_multi_segs {
                            Box::new(TmplExpr::ToStringWithoutUndefined(expr))
                        } else {
                            expr
                        }
                    }
                };
                cur = Box::new(TmplExpr::Plus(cur, next));
            }
            TextEntity::Dynamic(cur)
        } else {
            let s: Vec<&str> = segs
                .iter()
                .map(|x| {
                    if let TextEntity::Static(x) = x {
                        let x: &str = &x;
                        x
                    } else {
                        unreachable!()
                    }
                })
                .collect();
            TextEntity::Static(s.join(""))
        }
    }

    fn parse_segment(
        self: &Self,
        target: &mut TmplElement,
        pairs: &mut pest::iterators::Pairs<'_, Rule>,
    ) {
        while let Some(pair) = pairs.peek() {
            match pair.as_rule() {
                Rule::tag => {
                    let mut tag_pairs = pair.into_inner();
                    if let Some(pair) = tag_pairs.next() {
                        let read_attr = |mut pairs: pest::iterators::Pairs<Rule>| {
                            let name_pair = pairs.next().unwrap();
                            let name = name_pair.as_str().to_string();
                            let value_pair = pairs.next();
                            let loc = TmplLocation {
                                start: name_pair.as_span().end(),
                                end: match value_pair {
                                    None => name_pair.as_span().end(),
                                    Some(ref value_pair) => value_pair.as_span().end(),
                                },
                            };
                            let value = match value_pair {
                                None => TmplAttrValue::Dynamic {
                                    // TODO use a better representation for default static values
                                    expr: Box::new(TmplExpr::LitBool(true)),
                                    binding_map_keys: None,
                                },
                                Some(x) => {
                                    let value = x.into_inner().next().unwrap();
                                    match self.parse_text_entity(value) {
                                        TextEntity::Static(s) => TmplAttrValue::Static(s),
                                        TextEntity::Dynamic(expr) => TmplAttrValue::Dynamic {
                                            expr,
                                            binding_map_keys: None,
                                        },
                                    }
                                }
                            };
                            (name, value, loc)
                        };
                        match pair.as_rule() {
                            Rule::wxs_script_tag_begin => {
                                let mut elem = TmplElement::new("wxs", TmplVirtualType::Pure);
                                let pair = tag_pairs.next().unwrap();
                                match pair.as_rule() {
                                    Rule::wxs_script_tag => {
                                        let mut wxs_pairs = pair.into_inner();
                                        while let Some(pair) = wxs_pairs.next() {
                                            match pair.as_rule() {
                                                Rule::attr => {
                                                    let pairs = pair.into_inner();
                                                    let (name, value, loc) = read_attr(pairs);
                                                    elem.add_attr(name.as_str(), value, Some(loc));
                                                }
                                                Rule::wxs_script_body => {
                                                    let text: String = pair
                                                        .into_inner()
                                                        .map(|pair| match pair.as_rule() {
                                                            Rule::entity => {
                                                                entities::decode(pair.as_str())
                                                            }
                                                            Rule::pure_text => {
                                                                Cow::Borrowed(pair.as_str())
                                                            }
                                                            _ => unreachable!(),
                                                        })
                                                        .collect();
                                                    elem.append_text_node(TmplTextNode::Static(
                                                        text,
                                                    ));
                                                    break;
                                                }
                                                _ => unreachable!(),
                                            }
                                        }
                                    }
                                    _ => unreachable!(),
                                }
                                pairs.next();
                                target.append_element(elem);
                            }
                            Rule::tag_begin => {
                                let mut elem = {
                                    let mut pairs = pair.into_inner();
                                    let tag_name = pairs.next().unwrap().as_str();
                                    let virtual_type = if tag_name == "block" {
                                        TmplVirtualType::Pure
                                    } else {
                                        TmplVirtualType::None
                                    };
                                    let mut elem = TmplElement::new(tag_name, virtual_type);
                                    while let Some(pair) = pairs.next() {
                                        let pairs = pair.into_inner();
                                        let (name, value, loc) = read_attr(pairs);
                                        elem.add_attr(name.as_str(), value, Some(loc));
                                    }
                                    elem
                                };
                                if let Some(pair) = tag_pairs.next() {
                                    match pair.as_rule() {
                                        Rule::self_close => {}
                                        _ => unreachable!(),
                                    }
                                    pairs.next();
                                } else {
                                    pairs.next();
                                    self.parse_segment(&mut elem, pairs);
                                }
                                target.append_element(elem);
                            }
                            Rule::tag_end => {
                                let tag_name_matched = {
                                    let mut pairs = pair.into_inner();
                                    let tag_name = pairs.next().unwrap().as_str();
                                    target.tag_name_is(tag_name)
                                };
                                if tag_name_matched {
                                    pairs.next();
                                }
                                return;
                            }
                            _ => unreachable!(),
                        }
                    } else {
                        pairs.next();
                    }
                }
                Rule::text_node => {
                    match self.parse_text_entity(pair) {
                        TextEntity::Static(s) => {
                            if s.trim() != "" {
                                target.append_text_node(TmplTextNode::new_static(s))
                            }
                        }
                        TextEntity::Dynamic(expr) => {
                            target.append_text_node(TmplTextNode::new_dynamic(expr))
                        }
                    }
                    pairs.next();
                }
                _ => unreachable!(),
            }
        }
    }

    fn convert_directives_rec(
        self: &Self,
        path: &String,
        parent: &mut TmplElement,
        imports: &mut Vec<String>,
        includes: &mut Vec<String>,
        sub_templates: &mut HashMap<String, TmplElement>,
        scripts: &mut Vec<TmplScript>,
    ) -> Result<(), TmplParseError> {
        let old_children = std::mem::replace(&mut parent.children, vec![]);
        for node in old_children.into_iter() {
            match node {
                TmplNode::TextNode(text_node) => {
                    parent.children.push(TmplNode::TextNode(text_node));
                }
                TmplNode::Element(mut elem) => {
                    let mut inner_depth = 0;

                    // read all attrs
                    enum IfType {
                        None,
                        If(TmplAttr),
                        Elif(TmplAttr),
                        Else(TmplAttr),
                    }
                    let mut attr_if = IfType::None;
                    let mut attr_for = None;
                    let mut attr_for_item = None;
                    let mut attr_for_index = None;
                    let mut attr_key = None;
                    let mut attr_slot = None;
                    let mut slot_values: Vec<(String, String)> = vec![];
                    let mut generics: Option<HashMap<String, String>> = None;

                    // extract attrs
                    let old_attrs = std::mem::replace(&mut elem.attrs, vec![]);
                    for attr in old_attrs.into_iter() {
                        match &attr.kind {
                            TmplAttrKind::WxDirective { name } => {
                                match name.as_str() {
                                    "if" => attr_if = IfType::If(attr),
                                    "elif" => attr_if = IfType::Elif(attr),
                                    "else" => attr_if = IfType::Else(attr),
                                    "for" | "for-items" => attr_for = Some(attr.value),
                                    "for-item" => attr_for_item = Some(attr.value.static_value()),
                                    "for-index" => attr_for_index = Some(attr.value.static_value()),
                                    "key" => attr_key = Some(attr.value.static_value()),
                                    _ => {}
                                }
                                continue;
                            }
                            TmplAttrKind::Generic { name } => {
                                if let Some(map) = &mut generics {
                                    map.insert(name.to_string(), attr.value.static_value());
                                } else {
                                    let mut map = HashMap::new();
                                    map.insert(name.to_string(), attr.value.static_value());
                                    generics = Some(map);
                                }
                                continue;
                            }
                            TmplAttrKind::SlotProperty { name } => {
                                match &attr.value {
                                    TmplAttrValue::Static(s) => {
                                        if s.as_str() == "" {
                                            slot_values.push((name.to_string(), name.to_string()));
                                        } else {
                                            slot_values.push((
                                                name.to_string(),
                                                attr.value.static_value(),
                                            ));
                                        }
                                    }
                                    TmplAttrValue::Dynamic { expr, .. } => {
                                        match &**expr {
                                            TmplExpr::LitBool(true) => {
                                                slot_values
                                                    .push((name.to_string(), name.to_string()));
                                            }
                                            _ => {
                                                // TODO warn dynamic value
                                            }
                                        }
                                    }
                                }
                                continue;
                            }
                            TmplAttrKind::Slot => {
                                attr_slot = Some(attr.value);
                                continue;
                            }
                            _ => {}
                        }
                        elem.attrs.push(attr);
                    }

                    // handling special tags
                    match elem.tag_name.as_str() {
                        "include" | "import" => {
                            let old_attrs = std::mem::replace(&mut elem.attrs, vec![]);
                            let mut path = None;
                            for attr in old_attrs.into_iter() {
                                if attr.is_property("src") {
                                    if path.is_some() {
                                        // FIXME warn duplicated attr
                                    } else {
                                        let p = attr.value.static_value();
                                        path =
                                            Some(p.strip_suffix(".wxml").unwrap_or(&p).to_string());
                                    }
                                } else {
                                    // FIXME warn unused attr
                                }
                            }
                            match path {
                                Some(path) => {
                                    if elem.tag_name.as_str() == "import" {
                                        imports.push(path);
                                    } else {
                                        includes.push(path.clone());
                                        elem.virtual_type = TmplVirtualType::Include { path };
                                        elem.children.clear();
                                    }
                                }
                                None => {} // FIXME warn no src attr found
                            }
                            if elem.tag_name.as_str() == "import" {
                                continue;
                            }
                        }
                        "template" => {
                            let old_attrs = std::mem::replace(&mut elem.attrs, vec![]);
                            let mut name = None;
                            let mut target = None;
                            let mut data = None;
                            for attr in old_attrs.into_iter() {
                                if attr.is_property("name") {
                                    if name.is_some() {
                                        // FIXME warn duplicated attr
                                    } else {
                                        name = Some(attr.value.static_value());
                                    }
                                } else if attr.is_property("is") {
                                    if target.is_some() {
                                        // FIXME warn duplicated attr
                                    } else {
                                        target = Some(attr.value);
                                    }
                                } else if attr.is_property("data") {
                                    if data.is_some() {
                                        // FIXME warn duplicated attr
                                    } else {
                                        data = Some(attr.value);
                                    }
                                } else {
                                    // FIXME warn unused attr
                                }
                            }
                            match name {
                                Some(name) => {
                                    if target.is_some() || data.is_some() {
                                        // FIXME warn unused attr
                                    }
                                    self.convert_directives_rec(
                                        path,
                                        &mut elem,
                                        imports,
                                        includes,
                                        sub_templates,
                                        scripts,
                                    )?;
                                    sub_templates.insert(name, elem);
                                    continue;
                                }
                                None => {
                                    match target {
                                        Some(target) => {
                                            elem.virtual_type = TmplVirtualType::TemplateRef {
                                                target,
                                                data: match data {
                                                    Some(field) => {
                                                        if let TmplAttrValue::Dynamic {
                                                            expr,
                                                            binding_map_keys,
                                                        } = field
                                                        {
                                                            let expr = match *expr {
                                                                TmplExpr::Ident(s) => {
                                                                    TmplExpr::LitObj(vec![(
                                                                        Some(s.clone()),
                                                                        TmplExpr::Ident(s),
                                                                    )])
                                                                }
                                                                TmplExpr::LitObj(x) => {
                                                                    TmplExpr::LitObj(x)
                                                                }
                                                                _ => {
                                                                    // FIXME warn must be object
                                                                    TmplExpr::LitObj(vec![])
                                                                }
                                                            };
                                                            TmplAttrValue::Dynamic {
                                                                expr: Box::new(expr),
                                                                binding_map_keys,
                                                            }
                                                        } else {
                                                            // FIXME warn must be object data binding
                                                            TmplAttrValue::Dynamic {
                                                                expr: Box::new(TmplExpr::LitObj(
                                                                    vec![],
                                                                )),
                                                                binding_map_keys: None,
                                                            }
                                                        }
                                                    }
                                                    None => TmplAttrValue::Dynamic {
                                                        expr: Box::new(TmplExpr::LitObj(vec![])),
                                                        binding_map_keys: None,
                                                    },
                                                },
                                            }
                                        }
                                        None => {} // FIXME warn no src attr found
                                    }
                                }
                            }
                        }
                        "slot" => {
                            let old_attrs = std::mem::replace(&mut elem.attrs, vec![]);
                            let mut name = TmplAttrValue::Static(String::new());
                            let mut props: Option<Vec<TmplAttr>> = None;
                            for attr in old_attrs.into_iter() {
                                if attr.is_property("name") {
                                    name = attr.value;
                                } else if match attr.kind {
                                    TmplAttrKind::PropertyOrExternalClass { .. }
                                    | TmplAttrKind::Data { .. }
                                    | TmplAttrKind::Mark { .. }
                                    | TmplAttrKind::Event { .. } => true,
                                    _ => false,
                                } {
                                    if let Some(arr) = &mut props {
                                        arr.push(attr);
                                    } else {
                                        let mut arr = vec![];
                                        arr.push(attr);
                                        props = Some(arr);
                                    }
                                }
                            }
                            elem.virtual_type = TmplVirtualType::Slot { name, props };
                        }
                        "wxs" => {
                            let old_attrs = std::mem::replace(&mut elem.attrs, vec![]);
                            let mut module_name = String::new();
                            let mut src = String::new();
                            for attr in old_attrs.into_iter() {
                                if attr.is_property("module") {
                                    match attr.value {
                                        TmplAttrValue::Dynamic { .. } => {
                                            // FIXME warn must be static
                                        }
                                        TmplAttrValue::Static(s) => {
                                            module_name = s;
                                        }
                                    }
                                } else if attr.is_property("src") {
                                    match attr.value {
                                        TmplAttrValue::Dynamic { .. } => {
                                            // FIXME warn must be static
                                        }
                                        TmplAttrValue::Static(s) => {
                                            src = s.strip_suffix(".wxs").unwrap_or(&s).to_string();
                                        }
                                    }
                                } else {
                                    // FIXME warn unused attr
                                }
                            }
                            if src.len() == 0 {
                                let content = match elem.children.get(0) {
                                    Some(TmplNode::TextNode(TmplTextNode::Static(x))) => x.as_str(),
                                    None => "",
                                    _ => unreachable!(),
                                };
                                scripts.push(TmplScript::Inline {
                                    module_name,
                                    content: content.to_string(),
                                });
                            } else {
                                // FIXME warn unused script content
                                scripts.push(TmplScript::GlobalRef {
                                    module_name,
                                    rel_path: src,
                                });
                            }
                            continue;
                        }
                        _ => {}
                    }
                    elem.generics = generics;
                    elem.slot = attr_slot;

                    // a helper for generating middle virtual node
                    let mut wrap_virtual_elem = |mut elem: TmplElement, virtual_type| {
                        if let TmplVirtualType::Pure = elem.virtual_type {
                            elem.virtual_type = virtual_type;
                        } else {
                            let mut p = TmplElement::new("block", virtual_type);
                            p.append_element(elem);
                            elem = p;
                            inner_depth += 1;
                        }
                        elem
                    };

                    // handling if
                    match attr_if {
                        IfType::None => {}
                        IfType::If(attr_if) => {
                            let virtual_type = TmplVirtualType::If {
                                cond: attr_if.value,
                            };
                            elem = wrap_virtual_elem(elem, virtual_type);
                            elem = wrap_virtual_elem(elem, TmplVirtualType::IfGroup);
                        }
                        IfType::Elif(attr_if) => {
                            let virtual_type = TmplVirtualType::Elif {
                                cond: attr_if.value,
                            };
                            if let Some(last) = parent.children.last_mut() {
                                if let TmplNode::Element(last) = last {
                                    if let TmplVirtualType::IfGroup = last.virtual_type {
                                        if let Some(TmplNode::Element(TmplElement {
                                            virtual_type: TmplVirtualType::Else,
                                            ..
                                        })) = last.children.last()
                                        {
                                            return self.raise_error(
                                                "wx:elif has no adjacent wx:if",
                                                &attr_if.loc.unwrap(),
                                            );
                                        }
                                        self.convert_directives_rec(
                                            path,
                                            &mut elem,
                                            imports,
                                            includes,
                                            sub_templates,
                                            scripts,
                                        )?;
                                        elem = wrap_virtual_elem(elem, virtual_type);
                                        last.append_element(elem);
                                        // FIXME here should display a warning if <for> is found
                                        continue;
                                    }
                                }
                            }

                            return self.raise_error(
                                "wx:elif has no adjacent wx:if",
                                &attr_if.loc.unwrap(),
                            );
                        }
                        IfType::Else(attr_if) => {
                            let virtual_type = TmplVirtualType::Else;
                            if let Some(last) = parent.children.last_mut() {
                                if let TmplNode::Element(last) = last {
                                    if let TmplVirtualType::IfGroup = last.virtual_type {
                                        if let Some(TmplNode::Element(TmplElement {
                                            virtual_type: TmplVirtualType::Else,
                                            ..
                                        })) = last.children.last()
                                        {
                                            return self.raise_error(
                                                "wx:else has no adjacent wx:if",
                                                &attr_if.loc.unwrap(),
                                            );
                                        }
                                        self.convert_directives_rec(
                                            path,
                                            &mut elem,
                                            imports,
                                            includes,
                                            sub_templates,
                                            scripts,
                                        )?;
                                        elem = wrap_virtual_elem(elem, virtual_type);
                                        last.append_element(elem);
                                        // FIXME here should display a warning if <for> is found
                                        continue;
                                    }
                                }
                            }

                            return self.raise_error(
                                "wx:else has no adjacent wx:if",
                                &attr_if.loc.unwrap(),
                            );
                        }
                    }

                    // handling for
                    if let Some(attr_for) = attr_for {
                        let item_name = attr_for_item.unwrap_or("item".into());
                        let index_name = attr_for_index.unwrap_or("index".into());
                        let virtual_type = TmplVirtualType::For {
                            list: attr_for,
                            item_name,
                            index_name,
                            key: attr_key,
                        };
                        elem = wrap_virtual_elem(elem, virtual_type);
                    }

                    // recurse into children
                    let mut next = &mut elem;
                    for _ in 0..inner_depth {
                        next = match next.children.first_mut().unwrap() {
                            TmplNode::Element(elem) => elem,
                            TmplNode::TextNode(_) => unreachable!(),
                        }
                    }
                    self.convert_directives_rec(
                        path,
                        next,
                        imports,
                        includes,
                        sub_templates,
                        scripts,
                    )?;

                    // eliminate pure virtual node
                    let is_pure_virtual = if let TmplVirtualType::Pure = elem.virtual_type {
                        true
                    } else {
                        false
                    };
                    if is_pure_virtual && elem.slot.is_none() {
                        for child in elem.children.iter_mut() {
                            match child {
                                TmplNode::TextNode(..) => {}
                                TmplNode::Element(x) => {
                                    x.slot_values = slot_values.clone();
                                }
                            }
                        }
                        parent.children.append(&mut elem.children);
                    } else {
                        elem.slot_values = slot_values;
                        parent.children.push(TmplNode::Element(elem));
                    }
                }
            }
        }
        Ok(())
    }

    fn convert_directives(self: &Self, tree: &mut TmplTree) -> Result<(), TmplParseError> {
        let TmplTree {
            path,
            root,
            imports,
            includes,
            sub_templates,
            binding_map_collector: _,
            scripts,
        } = tree;

        self.convert_directives_rec(path, root, imports, includes, sub_templates, scripts)
    }

    fn prepare_expr_in_tree(self: &Self, tree: &mut TmplTree) {
        fn prepare_attr_value(
            v: &mut TmplAttrValue,
            bmc: &mut BindingMapCollector,
            scope_names: &Vec<String>,
            should_disable: bool,
        ) {
            match v {
                TmplAttrValue::Static(_) => {}
                TmplAttrValue::Dynamic {
                    expr,
                    binding_map_keys,
                } => {
                    *binding_map_keys = expr.get_binding_map_keys(bmc, scope_names, should_disable);
                }
            }
        }
        fn rec(
            parent: &mut TmplElement,
            bmc: &mut BindingMapCollector,
            scope_names: &Vec<String>,
            should_disable: bool,
        ) {
            for node in parent.children.iter_mut() {
                match node {
                    TmplNode::TextNode(ref mut text_node) => match text_node {
                        TmplTextNode::Static(_) => {}
                        TmplTextNode::Dynamic {
                            expr,
                            binding_map_keys,
                        } => {
                            *binding_map_keys =
                                expr.get_binding_map_keys(bmc, scope_names, should_disable);
                        }
                    },
                    TmplNode::Element(ref mut elem) => {
                        let should_disable = match &elem.virtual_type {
                            TmplVirtualType::None => should_disable,
                            _ => true,
                        };
                        let mut new_scope_names = None;
                        match &mut elem.virtual_type {
                            TmplVirtualType::None => {}
                            TmplVirtualType::Pure => {}
                            TmplVirtualType::IfGroup => {}
                            TmplVirtualType::If { cond } => {
                                prepare_attr_value(cond, bmc, scope_names, true);
                            }
                            TmplVirtualType::Elif { cond } => {
                                prepare_attr_value(cond, bmc, scope_names, true);
                            }
                            TmplVirtualType::Else => {}
                            TmplVirtualType::For {
                                list,
                                item_name,
                                index_name,
                                key: _,
                            } => {
                                prepare_attr_value(list, bmc, scope_names, true);
                                let s_len = scope_names.len();
                                let mut s = scope_names.clone();
                                let new_item_name = format!("${}", s_len);
                                let new_index_name = format!("${}", s_len + 1);
                                s.push(std::mem::replace(item_name, new_item_name));
                                s.push(std::mem::replace(index_name, new_index_name));
                                new_scope_names = Some(s);
                            }
                            TmplVirtualType::TemplateRef { target, data } => {
                                prepare_attr_value(target, bmc, scope_names, true);
                                prepare_attr_value(data, bmc, scope_names, true);
                            }
                            TmplVirtualType::Include { path: _ } => {}
                            TmplVirtualType::Slot { name, props } => {
                                prepare_attr_value(name, bmc, scope_names, true);
                                if let Some(props) = props {
                                    for attr in props.iter_mut() {
                                        prepare_attr_value(&mut attr.value, bmc, scope_names, true);
                                    }
                                }
                            }
                        }
                        if elem.slot_values.len() > 0 {
                            let s_len = scope_names.len();
                            let mut s = scope_names.clone();
                            for (index, (_, provide_name)) in
                                elem.slot_values.iter_mut().enumerate()
                            {
                                let new_provide_name = format!("${}", s_len + index);
                                s.push(std::mem::replace(provide_name, new_provide_name));
                            }
                            new_scope_names = Some(s);
                        }
                        let scope_names_ref = new_scope_names.as_ref().unwrap_or(scope_names);
                        for attr in elem.attrs.iter_mut() {
                            prepare_attr_value(
                                &mut attr.value,
                                bmc,
                                scope_names_ref,
                                should_disable,
                            );
                        }
                        if let Some(slot) = elem.slot.as_mut() {
                            prepare_attr_value(slot, bmc, scope_names_ref, should_disable);
                        }
                        rec(elem, bmc, scope_names_ref, should_disable);
                    }
                }
            }
        }
        let scope_names = tree
            .scripts
            .iter()
            .map(|script| match script {
                TmplScript::Inline { module_name, .. } => module_name.to_string(),
                TmplScript::GlobalRef { module_name, .. } => module_name.to_string(),
            })
            .collect();
        rec(
            &mut tree.root,
            &mut tree.binding_map_collector,
            &scope_names,
            false,
        );
        for tmpl in tree.sub_templates.values_mut() {
            rec(tmpl, &mut BindingMapCollector::new(), &scope_names, true);
        }
    }

    pub fn parse(self: &Self) -> Result<TmplTree, TmplParseError> {
        let mut pairs = TmplParser::parse(Rule::main, self.tmpl_str).map_err(|e| {
            use pest::error::*;
            let (start_pos, end_pos) = match e.line_col {
                LineColLocation::Pos(p) => (p, p),
                LineColLocation::Span(start, end) => (start, end),
            };
            let (start_location, end_location) = match e.location {
                InputLocation::Pos(p) => (p, p),
                InputLocation::Span(p) => p,
            };
            let message = match e.variant {
                ErrorVariant::ParsingError {
                    positives: _,
                    negatives: _,
                } => {
                    let mut message = String::from("Unexpected character ");
                    message.push_str(&self.tmpl_str[start_location..end_location + 1]);
                    message
                }
                ErrorVariant::CustomError { message: msg } => msg,
            };
            TmplParseError {
                filename: String::from(self.path),
                message,
                start_pos,
                end_pos,
            }
        })?;

        let mut tree = TmplTree::new();
        let main_pair = pairs.next().unwrap();
        let mut segment = main_pair.into_inner().next().unwrap().into_inner();
        self.parse_segment(tree.root_mut(), &mut segment);
        self.convert_directives(&mut tree)?;
        self.prepare_expr_in_tree(&mut tree);
        if let Some(pair) = segment.peek() {
            let span = pair.as_span();
            return Err(TmplParseError {
                filename: String::from(tree.path),
                message: String::from("Unexpected segment"),
                start_pos: span.start_pos().line_col(),
                end_pos: span.end_pos().line_col(),
            });
        }
        Ok(tree)
    }
}

/// Parse a template string, returning a `TmplTree` if success.
pub fn parse_tmpl(tmpl_str: &str, path: &str) -> Result<TmplTree, TmplParseError> {
    TmplParseTask::new(tmpl_str, path).parse()
}

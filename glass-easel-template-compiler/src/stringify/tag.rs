use std::{
    fmt::{Result as FmtResult, Write as FmtWrite},
    ops::Range,
};

use super::{Stringifier, Stringify};
use crate::{
    escape::{escape_html_body, escape_html_text},
    parse::{
        expr::Expression,
        tag::{
            ClassAttribute, CommonElementAttributes, Element, ElementKind, Ident, Node, Script,
            StaticAttribute, StrName, StyleAttribute, Value, DEFAULT_FOR_INDEX_SCOPE_NAME,
            DEFAULT_FOR_ITEM_SCOPE_NAME,
        },
        Position, Template,
    },
};

impl Stringify for Template {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        let globals = &self.globals;
        for import in globals.imports.iter() {
            stringifier.write_str(r#"<import src="#)?;
            stringifier.write_str_name_quoted(import)?;
            stringifier.write_str(r#"/>"#)?;
        }
        stringifier.scope_names.clear();
        for script in globals.scripts.iter() {
            stringifier
                .scope_names
                .push(script.module_name().name.clone());
            match script {
                Script::Inline {
                    module_name,
                    content,
                    content_location,
                } => {
                    stringifier.write_str(r#"<wxs module="#)?;
                    stringifier.write_str_name_quoted(module_name)?;
                    if content.len() > 0 {
                        stringifier.write_str(r#">"#)?;
                        stringifier.write_token(
                            &content.replace("</wxs", "< /wxs"),
                            None,
                            content_location,
                        )?;
                        stringifier.write_str(r#"</wxs>"#)?;
                    } else {
                        stringifier.write_str(r#"/>"#)?;
                    }
                }
                Script::GlobalRef { module_name, path } => {
                    stringifier.write_str(r#"<wxs module="#)?;
                    stringifier.write_str_name_quoted(module_name)?;
                    stringifier.write_str(r#" src="#)?;
                    stringifier.write_str_name_quoted(path)?;
                    stringifier.write_str(r#"/>"#)?;
                }
            }
        }
        for (template_name, nodes) in globals.sub_templates.iter() {
            stringifier.write_str(r#"<template name="#)?;
            stringifier.write_str_name_quoted(template_name)?;
            if nodes.len() > 0 {
                stringifier.write_str(r#">"#)?;
                for node in nodes {
                    node.stringify_write(stringifier)?;
                }
                stringifier.write_str(r#"</template>"#)?;
            } else {
                stringifier.write_str(r#"/>"#)?;
            }
        }
        for node in self.content.iter() {
            node.stringify_write(stringifier)?;
        }
        stringifier.scope_names.clear();
        Ok(())
    }
}

impl Stringify for Node {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        match self {
            Node::Text(value) => value.stringify_write(stringifier)?,
            Node::Element(element) => element.stringify_write(stringifier)?,
            Node::Comment(..) => {}
            Node::UnknownMetaTag(s, location) => {
                stringifier.write_str(r#"<!"#)?;
                stringifier.write_token(&escape_html_text(&s), None, &location)?;
                stringifier.write_str(r#">"#)?;
            }
        }
        Ok(())
    }
}

fn is_children_empty(children: &[Node]) -> bool {
    for n in children {
        match n {
            Node::Comment(..) => {}
            Node::Element(..) | Node::Text(..) | Node::UnknownMetaTag(..) => {
                return false;
            }
        }
    }
    true
}

impl Stringify for Element {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        // attribute writers
        fn is_empty_value(value: &Value) -> bool {
            match value {
                Value::Static { value, .. } => value.is_empty(),
                Value::Dynamic { .. } => false,
            }
        }
        let write_attr = |stringifier: &mut Stringifier<'s, W>,
                          prefix: Option<(&str, &Range<Position>)>,
                          name: &Ident,
                          value: &Value|
         -> FmtResult {
            stringifier.write_str(" ")?;
            if let Some((p, loc)) = prefix {
                stringifier.write_token(p, None, loc)?;
                stringifier.write_str(":")?;
            }
            stringifier.write_ident(name, true)?;
            if !is_empty_value(value) {
                stringifier.write_str(r#"=""#)?;
                value.stringify_write(stringifier)?;
                stringifier.write_str(r#"""#)?;
            }
            Ok(())
        };
        let write_static_attr = |stringifier: &mut Stringifier<'s, W>,
                                 prefix: Option<(&str, &Range<Position>)>,
                                 name: &Ident,
                                 value: &StrName|
         -> FmtResult {
            stringifier.write_str(" ")?;
            if let Some((p, loc)) = prefix {
                stringifier.write_token(p, None, loc)?;
                stringifier.write_str(":")?;
            }
            stringifier.write_ident(name, true)?;
            if value.name.len() > 0 {
                stringifier.write_str(r#"="#)?;
                stringifier.write_str_name_quoted(value)?;
            }
            Ok(())
        };
        let write_named_attr = |stringifier: &mut Stringifier<'s, W>,
                                name: &str,
                                location: &Range<Position>,
                                value: &Value|
         -> FmtResult {
            stringifier.write_str(" ")?;
            stringifier.write_token(name, Some(name), location)?;
            if !is_empty_value(value) {
                stringifier.write_str(r#"=""#)?;
                value.stringify_write(stringifier)?;
                stringifier.write_str(r#"""#)?;
            }
            Ok(())
        };
        let write_named_static_attr = |stringifier: &mut Stringifier<'s, W>,
                                       name: &str,
                                       location: &Range<Position>,
                                       value: &StrName|
         -> FmtResult {
            stringifier.write_str(" ")?;
            stringifier.write_token(name, Some(name), location)?;
            if value.name.len() > 0 {
                stringifier.write_str(r#"="#)?;
                stringifier.write_str_name_quoted(value)?;
            }
            Ok(())
        };
        let write_slot_and_slot_values = |stringifier: &mut Stringifier<'s, W>,
                                          slot: &Option<(Range<Position>, Value)>,
                                          slot_value_refs: &Vec<StaticAttribute>|
         -> FmtResult {
            for attr in slot_value_refs {
                let value = stringifier.add_scope(&attr.value.name).clone();
                stringifier.write_str(" ")?;
                stringifier.write_token(
                    "slot",
                    None,
                    attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                )?;
                stringifier.write_str(":")?;
                stringifier.write_token(
                    &attr.name.name,
                    Some(&attr.name.name),
                    &attr.name.location,
                )?;
                if value != &attr.name.name {
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(&StrName {
                        name: value,
                        location: attr.value.location.clone(),
                    })?;
                }
            }
            if let Some((loc, value)) = slot.as_ref() {
                write_named_attr(stringifier, "slot", loc, value)?;
            }
            Ok(())
        };
        let write_common_attributes_without_slot =
            |stringifier: &mut Stringifier<'s, W>, common: &CommonElementAttributes| -> FmtResult {
                let CommonElementAttributes {
                    id,
                    slot: _,
                    slot_value_refs: _,
                    event_bindings,
                    marks,
                } = common;
                if let Some((loc, value)) = id.as_ref() {
                    write_named_attr(stringifier, "id", loc, value)?;
                }
                for attr in marks.iter() {
                    let prefix = (
                        "mark",
                        attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                    );
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for ev in event_bindings.iter() {
                    let prefix = if ev.is_catch {
                        if ev.is_capture {
                            "capture-catch"
                        } else {
                            "catch"
                        }
                    } else if ev.is_mut {
                        if ev.is_capture {
                            "capture-mut-bind"
                        } else {
                            "mut-bind"
                        }
                    } else {
                        if ev.is_capture {
                            "capture-bind"
                        } else {
                            "bind"
                        }
                    };
                    write_attr(
                        stringifier,
                        Some((prefix, &ev.prefix_location)),
                        &ev.name,
                        &ev.value,
                    )?;
                }
                Ok(())
            };

        // handle `wx:if`
        if let ElementKind::If {
            branches,
            else_branch,
        } = &self.kind
        {
            let mut is_first = true;
            for (loc, value, children) in branches {
                stringifier.write_token("<", None, &self.start_tag_location.0)?;
                stringifier.write_str("block")?;
                let name = if is_first {
                    is_first = false;
                    "wx:if"
                } else {
                    "wx:elif"
                };
                write_named_attr(stringifier, name, loc, value)?;
                if !is_children_empty(children) {
                    stringifier.write_token(">", None, &self.start_tag_location.1)?;
                    for child in children {
                        child.stringify_write(stringifier)?;
                    }
                    stringifier.write_token(
                        "<",
                        None,
                        &self
                            .end_tag_location
                            .as_ref()
                            .unwrap_or(&self.start_tag_location)
                            .0,
                    )?;
                    stringifier.write_token("/", None, &self.close_location)?;
                    stringifier.write_str("block")?;
                    stringifier.write_token(
                        ">",
                        None,
                        &self
                            .end_tag_location
                            .as_ref()
                            .unwrap_or(&self.start_tag_location)
                            .1,
                    )?;
                } else {
                    stringifier.write_token("/", None, &self.close_location)?;
                    stringifier.write_token(">", None, &self.start_tag_location.1)?;
                }
            }
            if let Some((loc, children)) = else_branch.as_ref() {
                stringifier.write_token("<", None, &self.start_tag_location.0)?;
                stringifier.write_str("block")?;
                stringifier.write_str(" ")?;
                stringifier.write_token("wx:else", None, loc)?;
                if !is_children_empty(children) {
                    stringifier.write_token(">", None, &self.start_tag_location.1)?;
                    for child in children {
                        child.stringify_write(stringifier)?;
                    }
                    stringifier.write_token(
                        "<",
                        None,
                        &self
                            .end_tag_location
                            .as_ref()
                            .unwrap_or(&self.start_tag_location)
                            .0,
                    )?;
                    stringifier.write_token("/", None, &self.close_location)?;
                    stringifier.write_str("block")?;
                    stringifier.write_token(
                        ">",
                        None,
                        &self
                            .end_tag_location
                            .as_ref()
                            .unwrap_or(&self.start_tag_location)
                            .1,
                    )?;
                } else {
                    stringifier.write_token("/", None, &self.close_location)?;
                    stringifier.write_token(">", None, &self.start_tag_location.1)?;
                }
            }
            return Ok(());
        }

        // write tag start
        let prev_scopes_count = stringifier.scope_names.len();
        stringifier.write_token("<", None, &self.start_tag_location.0)?;
        match &self.kind {
            ElementKind::Normal {
                tag_name,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes,
                data,
                children: _,
                generics,
                extra_attr,
                common,
            } => {
                stringifier.write_ident(&tag_name, true)?;
                write_slot_and_slot_values(stringifier, &common.slot, &common.slot_value_refs)?;
                match class {
                    ClassAttribute::None => {}
                    ClassAttribute::String(location, value) => {
                        write_attr(
                            stringifier,
                            None,
                            &Ident {
                                name: "class".into(),
                                location: location.clone(),
                            },
                            &value,
                        )?;
                    }
                    ClassAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                match style {
                    StyleAttribute::None => {}
                    StyleAttribute::String(location, value) => {
                        write_attr(
                            stringifier,
                            None,
                            &Ident {
                                name: "style".into(),
                                location: location.clone(),
                            },
                            &value,
                        )?;
                    }
                    StyleAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                for attr in attributes.iter() {
                    let prefix = attr.is_model.then_some((
                        "model",
                        attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                    ));
                    write_attr(stringifier, prefix, &attr.name, &attr.value)?;
                }
                for attr in change_attributes.iter() {
                    let prefix = (
                        "change",
                        attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                    );
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for attr in worklet_attributes.iter() {
                    write_static_attr(
                        stringifier,
                        Some((
                            "worklet",
                            attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                        )),
                        &attr.name,
                        &attr.value,
                    )?;
                }
                for attr in data.iter() {
                    let prefix = (
                        "data",
                        attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                    );
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for attr in generics.iter() {
                    write_static_attr(
                        stringifier,
                        Some((
                            "generic",
                            attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                        )),
                        &attr.name,
                        &attr.value,
                    )?;
                }
                for attr in extra_attr.iter() {
                    write_static_attr(
                        stringifier,
                        Some((
                            "extra-attr",
                            attr.prefix_location.as_ref().unwrap_or(&attr.name.location),
                        )),
                        &attr.name,
                        &attr.value,
                    )?;
                }
                write_common_attributes_without_slot(stringifier, common)?;
            }
            ElementKind::Pure {
                children: _,
                slot,
                slot_value_refs,
            } => {
                stringifier.write_str("block")?;
                write_slot_and_slot_values(stringifier, slot, slot_value_refs)?;
            }
            ElementKind::For {
                list,
                item_name,
                index_name,
                key,
                children: _,
            } => {
                stringifier.write_str("block")?;
                write_named_attr(stringifier, "wx:for", &list.0, &list.1)?;
                if item_name.1.name.as_str() != DEFAULT_FOR_ITEM_SCOPE_NAME {
                    write_named_static_attr(
                        stringifier,
                        "wx:for-item",
                        &item_name.0,
                        &item_name.1,
                    )?;
                }
                if index_name.1.name.as_str() != DEFAULT_FOR_INDEX_SCOPE_NAME {
                    write_named_static_attr(
                        stringifier,
                        "wx:for-index",
                        &index_name.0,
                        &index_name.1,
                    )?;
                }
                if !key.1.name.is_empty() {
                    write_named_static_attr(stringifier, "wx:key", &key.0, &key.1)?;
                }
                stringifier.add_scope(&item_name.1.name);
                stringifier.add_scope(&index_name.1.name);
            }
            ElementKind::If { .. } => unreachable!(),
            ElementKind::TemplateRef { target, data } => {
                stringifier.write_str("template")?;
                write_named_attr(stringifier, "is", &target.0, &target.1)?;
                if !data.1.is_empty() {
                    write_named_attr(stringifier, "data", &data.0, &data.1)?;
                }
            }
            ElementKind::Include { path } => {
                stringifier.write_str("include")?;
                write_named_static_attr(stringifier, "src", &path.0, &path.1)?;
            }
            ElementKind::Slot {
                name,
                values,
                common,
            } => {
                stringifier.write_str("slot")?;
                write_slot_and_slot_values(stringifier, &common.slot, &common.slot_value_refs)?;
                if !name.1.is_empty() {
                    write_named_attr(stringifier, "name", &name.0, &name.1)?;
                }
                for attr in values.iter() {
                    write_attr(stringifier, None, &attr.name, &attr.value)?;
                }
                write_common_attributes_without_slot(stringifier, common)?;
            }
        }

        // write tag body and end
        let empty_children = vec![];
        let children = self.children().unwrap_or(&empty_children);
        if !is_children_empty(children) {
            stringifier.write_token(">", None, &self.start_tag_location.1)?;
            for child in children {
                child.stringify_write(stringifier)?;
            }
            stringifier.write_token(
                "<",
                None,
                &self
                    .end_tag_location
                    .as_ref()
                    .unwrap_or(&self.start_tag_location)
                    .0,
            )?;
            stringifier.write_token("/", None, &self.close_location)?;
            match &self.kind {
                ElementKind::Normal { tag_name, .. } => {
                    stringifier.write_ident(&tag_name, false)?;
                }
                ElementKind::Pure { .. } | ElementKind::For { .. } => {
                    stringifier.write_str("block")?;
                }
                ElementKind::If { .. } => unreachable!(),
                ElementKind::TemplateRef { .. } => {
                    stringifier.write_str("template")?;
                }
                ElementKind::Include { .. } => {
                    stringifier.write_str("include")?;
                }
                ElementKind::Slot { .. } => {
                    stringifier.write_str("slot")?;
                }
            }
            stringifier.write_token(
                ">",
                None,
                &self
                    .end_tag_location
                    .as_ref()
                    .unwrap_or(&self.start_tag_location)
                    .1,
            )?;
        } else {
            stringifier.write_token("/", None, &self.close_location)?;
            stringifier.write_token(">", None, &self.start_tag_location.1)?;
        }

        // reset scopes
        stringifier.scope_names.truncate(prev_scopes_count);

        Ok(())
    }
}

impl Stringify for Value {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        match self {
            Self::Static { value, location } => {
                let quoted = escape_html_body(&value);
                stringifier.write_token(&format!("{}", quoted), None, &location)?;
            }
            Self::Dynamic {
                expression,
                double_brace_location,
                binding_map_keys: _,
            } => {
                fn split_expression<'s, W: FmtWrite>(
                    expr: &Expression,
                    stringifier: &mut Stringifier<'s, W>,
                    start_location: &Range<Position>,
                    end_location: &Range<Position>,
                ) -> FmtResult {
                    match expr {
                        Expression::LitStr { value, location } => {
                            stringifier.write_token(&escape_html_body(value), None, location)?;
                            return Ok(());
                        }
                        Expression::ToStringWithoutUndefined { value, location } => {
                            stringifier.write_token("{{", None, &start_location)?;
                            value.stringify_write(stringifier)?;
                            stringifier.write_token("}}", None, &location)?;
                            return Ok(());
                        }
                        Expression::Plus {
                            left,
                            right,
                            location,
                        } => {
                            let split = if let Expression::ToStringWithoutUndefined { .. }
                            | Expression::LitStr { .. } = &**left
                            {
                                true
                            } else if let Expression::ToStringWithoutUndefined { .. }
                            | Expression::LitStr { .. } = &**right
                            {
                                true
                            } else {
                                false
                            };
                            if split {
                                split_expression(&left, stringifier, start_location, location)?;
                                split_expression(&right, stringifier, location, end_location)?;
                                return Ok(());
                            }
                        }
                        _ => {}
                    }
                    stringifier.write_token("{{", None, &start_location)?;
                    expr.stringify_write(stringifier)?;
                    stringifier.write_token("}}", None, &end_location)?;
                    Ok(())
                }
                split_expression(
                    &expression,
                    stringifier,
                    &double_brace_location.0,
                    &double_brace_location.1,
                )?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::stringify::Stringify;

    #[test]
    fn sourcemap_location() {
        let src = r#"
            <template is="a" />
            <template name="a">
                <a href="/"> A </a>
            </template>
        "#;
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier = crate::stringify::Stringifier::new(String::new(), "test", src);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, sourcemap) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            r#"<template name="a"><a href="/"> A </a></template><template is="a"/>"#
        );
        let mut expects = vec![
            (2, 28, 0, 16, Some("a")),
            (3, 16, 0, 19, None),
            (3, 17, 0, 20, Some("a")),
            (3, 19, 0, 22, Some("href")),
            (3, 25, 0, 28, None),
            (3, 27, 0, 30, None),
            (3, 28, 0, 31, None),
            (3, 31, 0, 34, None),
            (3, 32, 0, 35, None),
            (3, 17, 0, 36, None),
            (3, 34, 0, 37, None),
            (1, 12, 0, 49, None),
            (1, 22, 0, 59, Some("is")),
            (1, 26, 0, 63, None),
            (1, 29, 0, 65, None),
            (1, 30, 0, 66, None),
        ]
        .into_iter();
        for token in sourcemap.tokens() {
            let token = (
                token.get_src_line(),
                token.get_src_col(),
                token.get_dst_line(),
                token.get_dst_col(),
                token.get_name(),
            );
            assert_eq!(Some(token), expects.next());
        }
        assert!(expects.next().is_none());
    }
}

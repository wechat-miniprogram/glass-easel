use std::{fmt::{Result as FmtResult, Write as FmtWrite}, ops::Range};

use crate::{escape::{escape_html_body, escape_html_text}, parse::{
    expr::Expression, tag::{ClassAttribute, CommonElementAttributes, Element, ElementKind, Ident, Node, Script, StrName, StyleAttribute, Value, DEFAULT_FOR_INDEX_SCOPE_NAME, DEFAULT_FOR_ITEM_SCOPE_NAME}, Position, Template
}};
use super::{Stringifier, Stringify};

impl Stringify for Template {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        let globals = &self.globals;
        for import in globals.imports.iter() {
            stringifier.write_str(r#"<import src="#)?;
            stringifier.write_str_name_quoted(import)?;
            stringifier.write_str(r#"/>"#)?;
        }
        for script in globals.scripts.iter() {
            match script {
                Script::Inline { module_name, content, content_location } => {
                    stringifier.write_str(r#"<wxs module="#)?;
                    stringifier.write_str_name_quoted(module_name)?;
                    if content.len() > 0 {
                        stringifier.write_str(r#">"#)?;
                        stringifier.write_token(&content.replace("</wxs", "< /wxs"), content, content_location)?;
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
                stringifier.write_token(&escape_html_text(&s), &s, &location)?;
                stringifier.write_str(r#">"#)?;
            }
        }
        Ok(())
    }
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
        let write_attr = |
            stringifier: &mut Stringifier<'s, W>,
            prefix: Option<(&str, &Range<Position>)>,
            name: &Ident,
            value: &Value,
        | -> FmtResult {
            stringifier.write_str(" ")?;
            if let Some((p, loc)) = prefix {
                stringifier.write_token(p, p, loc)?;
                stringifier.write_str(":")?;
            }
            stringifier.write_ident(name)?;
            if !is_empty_value(value) {
                stringifier.write_str(r#"=""#)?;
                value.stringify_write(stringifier)?;
                stringifier.write_str(r#"""#)?;
            }
            Ok(())
        };
        let write_static_attr = |
            stringifier: &mut Stringifier<'s, W>,
            prefix: Option<(&str, &Range<Position>)>,
            name: &Ident,
            value: &StrName,
        | -> FmtResult {
            stringifier.write_str(" ")?;
            if let Some((p, loc)) = prefix {
                stringifier.write_token(p, p, loc)?;
                stringifier.write_str(":")?;
            }
            stringifier.write_ident(name)?;
            if value.name.len() > 0 {
                stringifier.write_str(r#"="#)?;
                stringifier.write_str_name_quoted(value)?;
            }
            Ok(())
        };
        let write_named_attr = |
            stringifier: &mut Stringifier<'s, W>,
            name: &str,
            location: &Range<Position>,
            value: &Value,
        | -> FmtResult {
            stringifier.write_str(" ")?;
            stringifier.write_token(name, name, location)?;
            if !is_empty_value(value) {
                stringifier.write_str(r#"=""#)?;
                value.stringify_write(stringifier)?;
                stringifier.write_str(r#"""#)?;
            }
            Ok(())
        };
        let write_named_static_attr = |
            stringifier: &mut Stringifier<'s, W>,
            name: &str,
            location: &Range<Position>,
            value: &StrName,
        | -> FmtResult {
            stringifier.write_str(" ")?;
            stringifier.write_token(name, name, location)?;
            if value.name.len() > 0 {
                stringifier.write_str(r#"="#)?;
                stringifier.write_str_name_quoted(value)?;
            }
            Ok(())
        };
        let write_common_attributes = |
            stringifier: &mut Stringifier<'s, W>,
            common: &CommonElementAttributes,
        | -> FmtResult {
            let CommonElementAttributes {
                id,
                slot,
                slot_value_refs,
                event_bindings,
                marks,
            } = common;
            if let Some((loc, value)) = id.as_ref() {
                write_named_attr(stringifier, "id", loc, value)?;
            }
            if let Some((loc, value)) = slot.as_ref() {
                write_named_attr(stringifier, "slot", loc, value)?;
            }
            for attr in marks.iter() {
                let prefix = ("mark", attr.prefix_location.as_ref().unwrap_or(&attr.name.location));
                write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
            }
            for attr in slot_value_refs.iter() {
                let value = stringifier.add_scope(&attr.value.name).clone();
                stringifier.write_str(" ")?;
                stringifier.write_token("slot", "slot", &attr.prefix_location)?;
                stringifier.write_str(":")?;
                stringifier.write_token(&attr.name.name, &attr.name.name, &attr.name.location)?;
                if value != &attr.name.name {
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(&StrName { name: value, location: attr.value.location.clone() })?;
                }
            }
            for ev in event_bindings.iter() {
                let prefix = if ev.is_catch {
                    if ev.is_capture { "capture-catch" } else { "catch" }
                } else if ev.is_mut {
                    if ev.is_capture { "capture-mut-bind" } else { "mut-bind" }
                } else {
                    if ev.is_capture { "capture-bind" } else { "bind" }
                };
                write_attr(stringifier, Some((prefix, &ev.prefix_location)), &ev.name, &ev.value)?;
            }
            Ok(())
        };

        // handle `wx:if`
        if let ElementKind::If { branches, else_branch } = &self.kind {
            let mut is_first = true;
            for (loc, value, children) in branches {
                stringifier.write_token("<", "<", &self.start_tag_location.0)?;
                stringifier.write_str("block")?;
                let name = if is_first {
                    is_first = false;
                    "wx:if"
                } else {
                    "wx:elif"
                };
                write_named_attr(stringifier, name, loc, value)?;
                if children.len() > 0 {
                    stringifier.write_token(">", ">", &self.start_tag_location.1)?;
                    for child in children {
                        child.stringify_write(stringifier)?;
                    }
                    stringifier.write_token("<", "<", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).0)?;
                    stringifier.write_token("/", "/", &self.close_location)?;
                    stringifier.write_str("block")?;
                    stringifier.write_token(">", ">", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).1)?;
                } else {
                    stringifier.write_token("/", "/", &self.close_location)?;
                    stringifier.write_token(">", ">", &self.start_tag_location.1)?;
                }
            }
            if let Some((loc, children)) = else_branch.as_ref() {
                stringifier.write_token("<", "<", &self.start_tag_location.0)?;
                stringifier.write_str("block")?;
                stringifier.write_str(" ")?;
                stringifier.write_token("wx:else", "wx:else", loc)?;
                if children.len() > 0 {
                    stringifier.write_token(">", ">", &self.start_tag_location.1)?;
                    for child in children {
                        child.stringify_write(stringifier)?;
                    }
                    stringifier.write_token("<", "<", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).0)?;
                    stringifier.write_token("/", "/", &self.close_location)?;
                    stringifier.write_str("block")?;
                    stringifier.write_token(">", ">", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).1)?;
                } else {
                    stringifier.write_token("/", "/", &self.close_location)?;
                    stringifier.write_token(">", ">", &self.start_tag_location.1)?;
                }
            }
            return Ok(())
        }

        // write tag start
        let prev_scopes_count = stringifier.scope_names.len();
        stringifier.write_token("<", "<", &self.start_tag_location.0)?;
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
                stringifier.write_ident(&tag_name)?;
                match class {
                    ClassAttribute::None => {}
                    ClassAttribute::String(location, value) => {
                        write_attr(stringifier, None, &Ident { name: "class".into(), location: location.clone() }, &value)?;
                    }
                    ClassAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                match style {
                    StyleAttribute::None => {}
                    StyleAttribute::String(location, value) => {
                        write_attr(stringifier, None, &Ident { name: "style".into(), location: location.clone() }, &value)?;
                    }
                    StyleAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                for attr in attributes.iter() {
                    let prefix = attr.is_model.then_some(("model", attr.prefix_location.as_ref().unwrap_or(&attr.name.location)));
                    write_attr(stringifier, prefix, &attr.name, &attr.value)?;
                }
                for attr in change_attributes.iter() {
                    let prefix = ("change", attr.prefix_location.as_ref().unwrap_or(&attr.name.location));
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for attr in worklet_attributes.iter() {
                    write_static_attr(stringifier, Some(("worklet", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
                for attr in data.iter() {
                    let prefix = ("data", attr.prefix_location.as_ref().unwrap_or(&attr.name.location));
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for attr in generics.iter() {
                    write_static_attr(stringifier, Some(("generic", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
                for attr in extra_attr.iter() {
                    write_static_attr(stringifier, Some(("extra-attr", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
                write_common_attributes(stringifier, common)?;
            }
            ElementKind::Pure {
                children: _,
                common,
            } => {
                stringifier.write_str("block")?;
                write_common_attributes(stringifier, common)?;
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
                    write_named_static_attr(stringifier, "wx:for-item", &item_name.0, &item_name.1)?;
                }
                if index_name.1.name.as_str() != DEFAULT_FOR_INDEX_SCOPE_NAME {
                    write_named_static_attr(stringifier, "wx:for-index", &index_name.0, &index_name.1)?;
                }
                if !key.1.name.is_empty() {
                    write_named_static_attr(stringifier, "wx:key", &key.0, &key.1)?;
                }
                stringifier.add_scope(&item_name.1.name);
                stringifier.add_scope(&index_name.1.name);
            }
            ElementKind::If { .. } => unreachable!(),
            ElementKind::TemplateRef {
                target,
                data,
            } => {
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
            ElementKind::Slot { name, values, common } => {
                stringifier.write_str("slot")?;
                if !name.1.is_empty() {
                    write_named_attr(stringifier, "name", &name.0, &name.1)?;
                }
                for attr in values.iter() {
                    write_attr(stringifier, None, &attr.name, &attr.value)?;
                }
                write_common_attributes(stringifier, common)?;
            }
        }

        // write tag body and end
        let empty_children = vec![];
        let children = self.children().unwrap_or(&empty_children);
        if children.len() > 0 {
            stringifier.write_token(">", ">", &self.start_tag_location.1)?;
            for child in children {
                child.stringify_write(stringifier)?;
            }
            stringifier.write_token("<", "<", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).0)?;
            stringifier.write_token("/", "/", &self.close_location)?;
            match &self.kind {
                ElementKind::Normal { tag_name, .. } => {
                    stringifier.write_ident(&tag_name)?;
                }
                ElementKind::Pure { .. } |
                ElementKind::For { .. } => {
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
            stringifier.write_token(">", ">", &self.end_tag_location.as_ref().unwrap_or(&self.start_tag_location).1)?;
        } else {
            stringifier.write_token("/", "/", &self.close_location)?;
            stringifier.write_token(">", ">", &self.start_tag_location.1)?;
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
                stringifier.write_token(&format!("{}", quoted), &value, &location)?;
            }
            Self::Dynamic { expression, double_brace_location, binding_map_keys: _ } => {
                fn split_expression<'s, W: FmtWrite>(
                    expr: &Expression,
                    stringifier: &mut Stringifier<'s, W>,
                    start_location: &Range<Position>,
                    end_location: &Range<Position>,
                ) -> FmtResult {
                    match expr {
                        Expression::LitStr { value, location } => {
                            stringifier.write_token(&escape_html_body(value), value, location)?;
                            return Ok(());
                        }
                        Expression::ToStringWithoutUndefined { value, location } => {
                            stringifier.write_token("{{", "{{", &start_location)?;
                            value.stringify_write(stringifier)?;
                            stringifier.write_token("}}", "}}", &location)?;
                            return Ok(());
                        }
                        Expression::Plus { left, right, location } => {
                            let split = if let Expression::ToStringWithoutUndefined { .. } | Expression::LitStr { .. } = &**left {
                                true
                            } else if let Expression::ToStringWithoutUndefined { .. } | Expression::LitStr { .. } = &**right {
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
                    stringifier.write_token("{{", "{{", &start_location)?;
                    expr.stringify_write(stringifier)?;
                    stringifier.write_token("}}", "}}", &end_location)?;
                    Ok(())
                }
                split_expression(&expression, stringifier, &double_brace_location.0, &double_brace_location.1)?;
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
        assert_eq!(output.as_str(), r#"<template name="a"><a href="/"> A </a></template><template is="a"/>"#);
        let mut expects = vec![
            (3, 28, 1, 16, "a"),
            (4, 16, 1, 19, "<"),
            (4, 17, 1, 20, "a"),
            (4, 19, 1, 22, "href"),
            (4, 25, 1, 28, "/"),
            (4, 27, 1, 30, ">"),
            (4, 28, 1, 31, " A "),
            (4, 31, 1, 34, "<"),
            (4, 32, 1, 35, "/"),
            (4, 17, 1, 36, "a"),
            (4, 34, 1, 37, ">"),
            (2, 12, 1, 49, "<"),
            (2, 22, 1, 59, "is"),
            (2, 26, 1, 63, "a"),
            (2, 29, 1, 65, "/"),
            (2, 30, 1, 66, ">"),
        ].into_iter();
        for token in sourcemap.tokens() {
            let token = (
                token.get_src_line(),
                token.get_src_col(),
                token.get_dst_line(),
                token.get_dst_col(),
                token.get_name().unwrap(),
            );
            assert_eq!(Some(token), expects.next());
        }
        assert!(expects.next().is_none());
    }
}

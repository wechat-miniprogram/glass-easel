use std::{fmt::{Result as FmtResult, Write as FmtWrite}, ops::Range};

use sourcemap::SourceMapBuilder;

use crate::{escape::{escape_html_text, escape_quote}, parse::{
    tag::{Attribute, ClassAttribute, Element, ElementKind, EventBinding, Ident, Node, Script, StrName, StyleAttribute, Value}, Position, Template, TemplateStructure
}};

pub struct Stringifier<'s, W: FmtWrite> {
    w: W,
    line: u32,
    utf16_col: u32,
    smb: SourceMapBuilder,
    source_path: &'s str,
}

impl<'s, W: FmtWrite> Stringifier<'s, W> {
    pub fn new(w: W, source_path: &'s str, source: &'s str) -> Self {
        let mut smb = SourceMapBuilder::new(Some(source_path));
        let source_id = smb.add_source(source_path);
        smb.set_source_contents(source_id, Some(source));
        Self {
            w,
            line: 0,
            utf16_col: 0,
            smb,
            source_path,
        }
    }

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

    fn write_token(&mut self, dest_text: &str, source_text: &str, location: &Range<Position>) -> FmtResult {
        self.smb.add(self.line + 1, self.utf16_col, location.start.line + 1, location.start.utf16_col, Some(self.source_path), Some(source_text));
        self.write_str(dest_text)?;
        Ok(())
    }

    fn write_str_name_quoted(&mut self, n: &StrName) -> FmtResult {
        let quoted = escape_quote(&n.name);
        self.write_token(&format!(r#""{}""#, quoted), &n.name, &n.location())
    }

    fn write_ident(&mut self, n: &Ident) -> FmtResult {
        self.write_token(&n.name, &n.name, &n.location())
    }
}

pub trait Stringify {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult;
}

impl Stringify for Template {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        let globals = &self.globals;
        for import in globals.imports.iter() {
            stringifier.write_str(r#"<import src="#)?;
            stringifier.write_str_name_quoted(import)?;
            stringifier.write_str(r#">"#)?;
        }
        for script in globals.scripts.iter() {
            match script {
                Script::Inline { module_name, content, content_location } => {
                    stringifier.write_str(r#"<wxs module="#)?;
                    stringifier.write_str_name_quoted(module_name)?;
                    stringifier.write_str(r#">"#)?;
                    stringifier.write_token(&content.replace("</wxs", "< /wxs"), content, content_location)?;
                    stringifier.write_str(r#"</wxs>"#)?;
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
            stringifier.write_str(r#">"#)?;
            for node in nodes {
                node.stringify_write(stringifier)?;
            }
            stringifier.write_str(r#"</template>"#)?;
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
                stringifier.write_ident(name)?;
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
                stringifier.write_ident(name)?;
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
            stringifier.write_token(name, name, location)?;
            stringifier.write_str(r#"=""#)?;
            value.stringify_write(stringifier)?;
            stringifier.write_str(r#"""#)?;
            Ok(())
        };
        let write_named_static_attr = |
            stringifier: &mut Stringifier<'s, W>,
            name: &str,
            location: &Range<Position>,
            value: &StrName,
        | -> FmtResult {
            stringifier.write_token(name, name, location)?;
            stringifier.write_str(r#"="#)?;
            stringifier.write_str_name_quoted(value)?;
            Ok(())
        };
        let write_event_bindings = |
            stringifier: &mut Stringifier<'s, W>,
            event_bindings: &Vec<EventBinding>,
            marks: &Vec<Attribute>,
            slot: &Option<(Range<Position>, Value)>,
        | -> FmtResult {
            if let Some((loc, value)) = slot.as_ref() {
                write_named_attr(stringifier, "slot", loc, value)?;
            }
            for attr in marks.iter() {
                let prefix = ("mark", attr.prefix_location.as_ref().unwrap_or(&attr.name.location));
                write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
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
        stringifier.write_token("<", "<", &self.start_tag_location.0)?;
        match &self.kind {
            ElementKind::Normal {
                tag_name,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes,
                event_bindings,
                marks,
                data,
                children: _,
                generics,
                extra_attr,
                slot,
                slot_value_refs,
            } => {
                stringifier.write_ident(&tag_name)?;
                match class {
                    ClassAttribute::None => {}
                    ClassAttribute::String(..) => {
                        todo!()
                    }
                    ClassAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                match style {
                    StyleAttribute::None => {}
                    StyleAttribute::String(..) => {
                        todo!()
                    }
                    StyleAttribute::Multiple(..) => {
                        todo!()
                    }
                }
                if let Some((loc, value)) = slot.as_ref() {
                    write_named_attr(stringifier, "slot", loc, value)?;
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
                write_event_bindings(stringifier, event_bindings, marks, slot)?;
                for attr in data.iter() {
                    let prefix = ("data", attr.prefix_location.as_ref().unwrap_or(&attr.name.location));
                    write_attr(stringifier, Some(prefix), &attr.name, &attr.value)?;
                }
                for attr in generics.iter() {
                    write_static_attr(stringifier, Some(("generic", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
                for attr in extra_attr.iter() {
                    write_static_attr(stringifier, Some(("extra_attr", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
                for attr in slot_value_refs.iter() {
                    write_static_attr(stringifier, Some(("slot", &attr.prefix_location)), &attr.name, &attr.value)?;
                }
            }
            ElementKind::Pure {
                event_bindings,
                marks,
                children: _,
                slot,
            } => {
                stringifier.write_str("block")?;
                write_event_bindings(stringifier, event_bindings, marks, slot)?;
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
                write_named_static_attr(stringifier, "wx:for-item", &item_name.0, &item_name.1)?;
                write_named_static_attr(stringifier, "wx:for-index", &index_name.0, &index_name.1)?;
                write_named_static_attr(stringifier, "wx:key", &key.0, &key.1)?;
            }
            ElementKind::If { .. } => unreachable!(),
            ElementKind::TemplateRef {
                target,
                data,
                event_bindings,
                marks,
                slot,
            } => {
                stringifier.write_str("template")?;
                write_named_attr(stringifier, "is", &target.0, &target.1)?;
                write_named_attr(stringifier, "data", &data.0, &data.1)?;
                stringifier.write_str("block")?;
                write_event_bindings(stringifier, event_bindings, marks, slot)?;
            }
            ElementKind::Include { path, event_bindings, marks, slot } => {
                stringifier.write_str("include")?;
                write_named_static_attr(stringifier, "src", &path.0, &path.1)?;
                write_event_bindings(stringifier, event_bindings, marks, slot)?;
            }
            ElementKind::Slot { event_bindings, marks, slot, name, values } => {
                stringifier.write_str("slot")?;
                if !name.1.is_empty() {
                    write_named_attr(stringifier, "name", &name.0, &name.1)?;
                }
                write_event_bindings(stringifier, event_bindings, marks, slot)?;
                for attr in values.iter() {
                    write_attr(stringifier, None, &attr.name, &attr.value)?;
                }
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
        Ok(())
    }
}

impl Stringify for Value {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        todo!(); // TODO
        Ok(())
    }
}

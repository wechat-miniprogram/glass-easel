use std::{
    borrow::Cow,
    fmt::{Result as FmtResult, Write as FmtWrite},
    ops::Range,
};

use compact_str::CompactString;

use super::stringifier::*;
use crate::{
    escape::{escape_html_body, gen_lit_str},
    parse::{
        expr::Expression,
        tag::{
            ClassAttribute, CommonElementAttributes, Element, ElementKind, Ident, Node,
            NormalAttributePrefix, Script, StaticAttribute, StrName, StyleAttribute, Value,
            DEFAULT_FOR_INDEX_SCOPE_NAME, DEFAULT_FOR_ITEM_SCOPE_NAME,
        },
        Position, Template, TemplateStructure,
    },
};

impl Stringify for Template {
    fn stringify_write<'s, W: FmtWrite>(&self, stringifier: &mut Stringifier<'s, W>) -> FmtResult {
        stringifier.block(|stringifier| {
            let globals = &self.globals;
            for i in globals.imports.iter() {
                stringifier.write_line(|stringifier| {
                    stringifier.write_token("<", None, &i.tag_location.start.0)?;
                    stringifier.write_str(r#"import "#)?;
                    stringifier.write_token("src", None, &i.src_location)?;
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(&i.src)?;
                    stringifier.write_optional_space()?;
                    stringifier.write_token("/", None, &i.tag_location.close)?;
                    stringifier.write_token(">", None, &i.tag_location.start.1)?;
                    Ok(())
                })?;
            }
            for script in globals.scripts.iter() {
                stringifier.add_scope(&script.module_name().name);
                match script {
                    Script::Inline {
                        tag_location,
                        module_location,
                        module_name,
                        content,
                        content_location,
                    } => {
                        stringifier.empty_seperation_line()?;
                        stringifier.write_line(|stringifier| {
                            stringifier.write_token("<", None, &tag_location.start.0)?;
                            stringifier.write_str(r#"wxs "#)?;
                            stringifier.write_token("module", None, module_location)?;
                            stringifier.write_str(r#"="#)?;
                            stringifier.write_str_name_quoted(module_name)?;
                            if content.len() > 0 {
                                stringifier.write_token(">", None, &tag_location.start.1)?;
                                stringifier.write_token(
                                    &content.replace("</wxs", "< /wxs"),
                                    None,
                                    content_location,
                                )?;
                                stringifier.write_token(
                                    r#"<"#,
                                    None,
                                    &tag_location.end.as_ref().unwrap_or(&tag_location.start).0,
                                )?;
                                stringifier.write_token("/", None, &tag_location.close)?;
                                stringifier.write_str(r#"wxs"#)?;
                                stringifier.write_token(
                                    r#">"#,
                                    None,
                                    &tag_location.end.as_ref().unwrap_or(&tag_location.start).1,
                                )?;
                            } else {
                                stringifier.write_optional_space()?;
                                stringifier.write_token("/", None, &tag_location.close)?;
                                stringifier.write_token(">", None, &tag_location.start.1)?;
                            }
                            Ok(())
                        })?;
                    }
                    Script::GlobalRef {
                        tag_location,
                        module_location,
                        module_name,
                        src_location,
                        src,
                    } => {
                        stringifier.empty_seperation_line()?;
                        stringifier.write_line(|stringifier| {
                            stringifier.write_token("<", None, &tag_location.start.0)?;
                            stringifier.write_str(r#"wxs "#)?;
                            stringifier.write_token("module", None, module_location)?;
                            stringifier.write_str(r#"="#)?;
                            stringifier.write_str_name_quoted(module_name)?;
                            stringifier.write_str(r#" "#)?;
                            stringifier.write_token("src", None, src_location)?;
                            stringifier.write_str(r#"="#)?;
                            stringifier.write_str_name_quoted(src)?;
                            stringifier.write_optional_space()?;
                            stringifier.write_token("/", None, &tag_location.close)?;
                            stringifier.write_token(">", None, &tag_location.start.1)?;
                            Ok(())
                        })?;
                    }
                }
            }
            for t in globals.sub_templates.iter() {
                let tag_location = &t.tag_location;
                stringifier.empty_seperation_line()?;
                stringifier.write_line(|stringifier| {
                    stringifier.write_token("<", None, &tag_location.start.0)?;
                    stringifier.write_str(r#"template "#)?;
                    stringifier.write_token("name", None, &t.name_location)?;
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(&t.name)?;
                    if !t.content.is_empty() {
                        stringifier.write_str(r#">"#)?;
                        children_inline_stringify_write(
                            &t.content,
                            t.tag_location.start.1.end,
                            t.tag_location
                                .end
                                .as_ref()
                                .unwrap_or(&t.tag_location.start)
                                .0
                                .start,
                            stringifier,
                        )?;
                        stringifier.write_token(
                            r#"<"#,
                            None,
                            &tag_location.end.as_ref().unwrap_or(&tag_location.start).0,
                        )?;
                        stringifier.write_token("/", None, &tag_location.close)?;
                        stringifier.write_str(r#"template"#)?;
                        stringifier.write_token(
                            r#">"#,
                            None,
                            &tag_location.end.as_ref().unwrap_or(&tag_location.start).1,
                        )?;
                    } else {
                        stringifier.write_optional_space()?;
                        stringifier.write_token("/", None, &tag_location.close)?;
                        stringifier.write_token(">", None, &tag_location.start.1)?;
                    }
                    Ok(())
                })?;
            }
            if stringifier.current_position().line_col_utf16() == (0, 0)
                && is_children_single_text(&self.content, !stringifier.minimize()).is_some()
            {
                stringifier.write_line(|stringifier| {
                    children_inline_stringify_write(
                        &self.content,
                        self.content.first().unwrap().location_end(),
                        self.content.last().unwrap().location_start(),
                        stringifier,
                    )
                })?;
            } else if self.content.len() > 0 {
                stringifier.empty_seperation_line()?;
                children_stringify_write(
                    &self.content,
                    self.content.first().unwrap().location_end(),
                    self.content.last().unwrap().location_start(),
                    stringifier,
                )?;
            }
            Ok(())
        })
    }
}

fn children_stringify_write<'s, 't, W: FmtWrite>(
    children: &[Node],
    parent_start: Position,
    parent_end: Position,
    stringifier: &mut StringifierBlock<'s, 't, W>,
) -> FmtResult {
    let mut last_end_position = parent_start;
    let mut item_iter = children.iter().peekable();
    while let Some(item) = item_iter.next() {
        stringifier.new_scope_space(|stringifier| {
            // write an empty line if there is line gap in the source code
            if !stringifier.minimize() {
                if item
                    .location_start()
                    .line
                    .saturating_sub(last_end_position.line)
                    > 1
                {
                    stringifier.empty_seperation_line()?;
                }
            }

            stringifier.write_line(|stringifier| {
                // for text node, write an empty comment
                if !stringifier.minimize() {
                    if let Node::Text(_) = item {
                        stringifier.write_str("<!---->")?;
                    }
                }

                // write the text node it self
                item.stringify_write(stringifier)?;

                // write following text nodes and comments in the same line
                if !stringifier.minimize() {
                    let mut end_item = item;
                    while let Some(peek) = item_iter.peek() {
                        // for text nodes, write it
                        if let Node::Text(_) = peek {
                            end_item = item_iter.next().unwrap();
                            end_item.stringify_write(stringifier)?;
                            continue;
                        }

                        // for comments in the same line, write it
                        if let Node::Comment(comment) = peek {
                            if comment.location.start.line == item.location_end().line {
                                if let Node::Text(_) = end_item {
                                    // empty
                                } else {
                                    stringifier.write_str(r#" "#)?;
                                }
                                end_item = item_iter.next().unwrap();
                                end_item.stringify_write(stringifier)?;
                                continue;
                            }
                        }

                        break;
                    }

                    // if ends with text node, write an empty comment
                    if let Node::Text(_) = end_item {
                        stringifier.write_str("<!---->")?;
                    }
                    last_end_position = end_item.location_end();
                }
                Ok(())
            })
        })?;
    }

    if !stringifier.minimize() {
        if parent_end.line.saturating_sub(last_end_position.line) > 1 {
            stringifier.empty_seperation_line()?;
        }
    }
    Ok(())
}

impl StringifyLine for Node {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(
        &self,
        stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    ) -> FmtResult {
        match self {
            Node::Text(value) => value.stringify_write(stringifier),
            Node::Element(element) => ElementWithWx::NoWx(element).stringify_write(stringifier),
            Node::Comment(comment) => {
                if !stringifier.minimize() {
                    let full_text = format!("<!--{}-->", comment.content);
                    stringifier.write_token(&full_text, None, &comment.location)?;
                }
                Ok(())
            }
            Node::UnknownMetaTag(t) => {
                stringifier.write_str(r#"<!"#)?;
                for (i, name) in t.tag_name.iter().enumerate() {
                    if i > 0 {
                        stringifier.write_str(":")?;
                    }
                    stringifier.write_ident(name, true)?;
                }
                let list: Vec<_> = t
                    .attributes
                    .iter()
                    .map(|attr| WriteAttrItem::CustomAttr {
                        name: &attr.colon_separated_name,
                        value: attr.value.as_ref(),
                    })
                    .collect();
                stringifier.list(&list)?;
                stringifier.write_str(r#">"#)?;
                Ok(())
            }
        }
    }
}

fn children_inline_stringify_write<'s, 't, 'u, W: FmtWrite>(
    children: &[Node],
    parent_start: Position,
    parent_end: Position,
    stringifier: &mut StringifierLine<'s, 't, 'u, W>,
) -> FmtResult {
    if let Some(value) = is_children_single_text(children, !stringifier.minimize()) {
        value.stringify_write(stringifier)
    } else {
        stringifier.write_sub_block(|stringifier| {
            children_stringify_write(children, parent_start, parent_end, stringifier)
        })
    }
}

fn is_children_empty(children: &[Node], preserve_comment: bool) -> bool {
    for n in children {
        match n {
            Node::Comment(..) if !preserve_comment => {}
            Node::Comment(..) | Node::Element(..) | Node::Text(..) | Node::UnknownMetaTag(..) => {
                return false;
            }
        }
    }
    true
}

fn is_children_single_text(children: &[Node], preserve_comment: bool) -> Option<&Value> {
    let mut ret = None;
    for n in children {
        match n {
            Node::Comment(..) if !preserve_comment => {}
            Node::Text(x) => {
                if ret.is_some() {
                    return None;
                }
                ret = Some(x)
            }
            Node::Comment(..) | Node::Element(..) | Node::UnknownMetaTag(..) => {
                return None;
            }
        }
    }
    ret
}

fn is_children_single_non_scope_element(
    children: &[Node],
    preserve_comment: bool,
) -> Option<&Element> {
    let mut ret = None;
    for n in children {
        match n {
            Node::Comment(..) if !preserve_comment => {}
            Node::Element(x) => {
                if ret.is_some() {
                    return None;
                }
                if x.slot_value_refs().and_then(|mut x| x.next()).is_some() {
                    return None;
                }
                if x.let_var_refs().and_then(|mut x| x.next()).is_some() {
                    return None;
                }
                match x.kind {
                    ElementKind::Normal { .. } | ElementKind::Slot { .. } => {
                        ret = Some(x);
                    }
                    _ => {
                        return None;
                    }
                }
            }
            Node::Comment(..) | Node::Text(..) | Node::UnknownMetaTag(..) => {
                return None;
            }
        }
    }
    ret
}

fn is_empty_value(value: &Value) -> bool {
    match value {
        Value::Static { value, .. } => value.is_empty(),
        Value::Dynamic { .. } => false,
    }
}

fn write_slot_and_slot_values<'a, 's, 't, 'u, W: FmtWrite>(
    stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    list: &mut Vec<WriteAttrItem<'a>>,
    slot: &'a Option<(Range<Position>, Value)>,
    slot_value_refs: &'a Vec<StaticAttribute>,
) {
    for attr in slot_value_refs {
        let scope_name = stringifier.add_scope(&attr.value.name).clone();
        list.push(WriteAttrItem::SlotValue { attr, scope_name });
    }
    if let Some((loc, value)) = slot.as_ref() {
        list.push(WriteAttrItem::NamedAttr {
            name: "slot",
            location: loc.clone(),
            value,
        });
    }
}

fn write_common_attributes_without_slot<'a>(
    list: &mut Vec<WriteAttrItem<'a>>,
    common: &'a CommonElementAttributes,
) {
    let CommonElementAttributes {
        id,
        slot: _,
        slot_value_refs: _,
        event_bindings,
        data,
        marks,
    } = common;
    if let Some((loc, value)) = id.as_ref() {
        list.push(WriteAttrItem::NamedAttr {
            name: "id",
            location: loc.clone(),
            value,
        });
    }
    for attr in data.iter() {
        let prefix = (
            "data",
            attr.prefix_location
                .as_ref()
                .unwrap_or(&attr.name.location)
                .clone(),
        );
        let item = WriteAttrItem::Attr {
            prefix: Some(prefix),
            name: Cow::Borrowed(&attr.name),
            value: attr.value.as_ref(),
            respect_none_value: true,
        };
        list.push(item);
    }
    for attr in marks.iter() {
        let prefix = (
            "mark",
            attr.prefix_location
                .as_ref()
                .unwrap_or(&attr.name.location)
                .clone(),
        );
        let item = WriteAttrItem::Attr {
            prefix: Some(prefix),
            name: Cow::Borrowed(&attr.name),
            value: attr.value.as_ref(),
            respect_none_value: true,
        };
        list.push(item);
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
        let item = WriteAttrItem::Attr {
            prefix: Some((prefix, ev.prefix_location.clone())),
            name: Cow::Borrowed(&ev.name),
            value: ev.value.as_ref(),
            respect_none_value: false,
        };
        list.push(item);
    }
}

#[derive(Debug, Clone)]
enum WriteAttrItem<'a> {
    NamedAttr {
        name: &'static str,
        location: Range<Position>,
        value: &'a Value,
    },
    NamedStaticAttr {
        name: &'a str,
        location: Range<Position>,
        value: Cow<'a, StrName>,
    },
    Attr {
        prefix: Option<(&'a str, Range<Position>)>,
        name: Cow<'a, Ident>,
        value: Option<&'a Value>,
        respect_none_value: bool,
    },
    StaticAttr {
        prefix: Option<(&'a str, Range<Position>)>,
        name: &'a Ident,
        value: &'a StrName,
    },
    SlotValue {
        attr: &'a StaticAttribute,
        scope_name: CompactString,
    },
    CustomAttr {
        name: &'a [Ident],
        value: Option<&'a Value>,
    },
    NameOnly {
        name: &'static str,
        location: Range<Position>,
    },
}

impl StringifyLine for WriteAttrItem<'_> {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(
        &self,
        stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    ) -> FmtResult {
        match self {
            Self::NamedAttr {
                name,
                location,
                value,
            } => {
                stringifier.write_token(name, Some(name), location)?;
                if !is_empty_value(value) {
                    stringifier.write_str(r#"=""#)?;
                    value.stringify_write(stringifier)?;
                    stringifier.write_str(r#"""#)?;
                }
            }
            Self::NamedStaticAttr {
                name,
                location,
                value,
            } => {
                stringifier.write_token(name, Some(name), location)?;
                if value.name.len() > 0 {
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(value)?;
                }
            }
            Self::Attr {
                prefix,
                name,
                value,
                respect_none_value,
            } => {
                if let Some((p, loc)) = prefix {
                    stringifier.write_token(p, None, loc)?;
                    stringifier.write_str(":")?;
                }
                stringifier.write_ident(name, true)?;
                let value = match respect_none_value {
                    false => match *value {
                        None => None,
                        Some(value) => (!is_empty_value(value)).then_some(value),
                    },
                    true => *value,
                };
                if let Some(value) = value {
                    stringifier.write_str(r#"=""#)?;
                    value.stringify_write(stringifier)?;
                    stringifier.write_str(r#"""#)?;
                }
            }
            Self::StaticAttr {
                prefix,
                name,
                value,
            } => {
                if let Some((p, loc)) = prefix {
                    stringifier.write_token(p, None, loc)?;
                    stringifier.write_str(":")?;
                }
                stringifier.write_ident(name, true)?;
                if value.name.len() > 0 {
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(value)?;
                }
            }
            Self::SlotValue { attr, scope_name } => {
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
                if scope_name != &attr.name.name {
                    stringifier.write_str(r#"="#)?;
                    stringifier.write_str_name_quoted(&StrName {
                        name: scope_name.clone(),
                        location: attr.value.location.clone(),
                    })?;
                }
            }
            Self::CustomAttr { name, value } => {
                for (i, name) in name.iter().enumerate() {
                    if i > 0 {
                        stringifier.write_str(":")?;
                    }
                    stringifier.write_ident(name, true)?;
                }
                if let Some(value) = value {
                    stringifier.write_str(r#"=""#)?;
                    value.stringify_write(stringifier)?;
                    stringifier.write_str(r#"""#)?;
                }
            }
            Self::NameOnly { name, location } => stringifier.write_token(name, None, location)?,
        }
        Ok(())
    }
}

impl StringifyItem for WriteAttrItem<'_> {}

enum ElementWithWx<'a> {
    NoWx(&'a Element),
    WithWx(&'a Element, &'a [WriteAttrItem<'a>]),
}

impl<'a> StringifyLine for ElementWithWx<'a> {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(
        &self,
        stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    ) -> FmtResult {
        let elem = match self {
            Self::NoWx(elem) => elem,
            Self::WithWx(elem, _) => elem,
        };
        let wx_items = match self {
            Self::NoWx(_) => Default::default(),
            Self::WithWx(_, items) => *items,
        };

        // handle `wx:if`
        if let ElementKind::If {
            branches,
            else_branch,
        } = &elem.kind
        {
            debug_assert!(wx_items.is_empty());
            let mut is_first = true;
            for (loc, value, children) in branches {
                let name = if is_first {
                    is_first = false;
                    "wx:if"
                } else {
                    "wx:elif"
                };
                let list = [WriteAttrItem::NamedAttr {
                    name,
                    location: loc.clone(),
                    value,
                }];
                if let Some(child) =
                    is_children_single_non_scope_element(&children, !stringifier.minimize())
                {
                    ElementWithWx::WithWx(child, &list).stringify_write(stringifier)?;
                } else {
                    stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                    stringifier.write_str("block")?;
                    stringifier.list(&list)?;
                    if !is_children_empty(children, !stringifier.minimize()) {
                        stringifier.write_token(">", None, &elem.tag_location.start.1)?;
                        children_inline_stringify_write(children, loc.start, loc.end, stringifier)?;
                        stringifier.write_token(
                            "<",
                            None,
                            &elem
                                .tag_location
                                .end
                                .as_ref()
                                .unwrap_or(&elem.tag_location.start)
                                .0,
                        )?;
                        stringifier.write_token("/", None, &elem.tag_location.close)?;
                        stringifier.write_str("block")?;
                        stringifier.write_token(
                            ">",
                            None,
                            &elem
                                .tag_location
                                .end
                                .as_ref()
                                .unwrap_or(&elem.tag_location.start)
                                .1,
                        )?;
                    } else {
                        stringifier.write_optional_space()?;
                        stringifier.write_token("/", None, &elem.tag_location.close)?;
                        stringifier.write_token(">", None, &elem.tag_location.start.1)?;
                    }
                }
            }
            if let Some((loc, children)) = else_branch.as_ref() {
                let list = [WriteAttrItem::NameOnly {
                    name: "wx:else",
                    location: loc.clone(),
                }];
                if let Some(child) =
                    is_children_single_non_scope_element(&children, !stringifier.minimize())
                {
                    ElementWithWx::WithWx(child, &list).stringify_write(stringifier)?;
                } else {
                    stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                    stringifier.write_str("block")?;
                    stringifier.list(&list)?;
                    if !is_children_empty(children, !stringifier.minimize()) {
                        stringifier.write_token(">", None, &elem.tag_location.start.1)?;
                        children_inline_stringify_write(children, loc.start, loc.end, stringifier)?;
                        stringifier.write_token(
                            "<",
                            None,
                            &elem
                                .tag_location
                                .end
                                .as_ref()
                                .unwrap_or(&elem.tag_location.start)
                                .0,
                        )?;
                        stringifier.write_token("/", None, &elem.tag_location.close)?;
                        stringifier.write_str("block")?;
                        stringifier.write_token(
                            ">",
                            None,
                            &elem
                                .tag_location
                                .end
                                .as_ref()
                                .unwrap_or(&elem.tag_location.start)
                                .1,
                        )?;
                    } else {
                        stringifier.write_optional_space()?;
                        stringifier.write_token("/", None, &elem.tag_location.close)?;
                        stringifier.write_token(">", None, &elem.tag_location.start.1)?;
                    }
                }
            }
            return Ok(());
        }

        // write tag start
        let mut attr_list: Vec<WriteAttrItem> = vec![];
        let mut children_merged = false;
        match &elem.kind {
            ElementKind::Normal {
                tag_name,
                attributes,
                class,
                style,
                change_attributes,
                worklet_attributes,
                children: _,
                generics,
                extra_attr,
                let_vars,
                common,
            } => {
                stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                stringifier.write_ident(&tag_name, true)?;
                attr_list.extend(wx_items.iter().cloned());
                write_slot_and_slot_values(
                    stringifier,
                    &mut attr_list,
                    &common.slot,
                    &common.slot_value_refs,
                );
                for attr in let_vars.iter() {
                    let scope_name = stringifier.add_scope(&attr.name.name);
                    let prefix = (
                        "let",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::Attr {
                        prefix: Some(prefix),
                        name: if scope_name != &attr.name.name {
                            Cow::Owned(Ident {
                                name: scope_name.clone(),
                                location: attr.name.location(),
                            })
                        } else {
                            Cow::Borrowed(&attr.name)
                        },
                        value: attr.value.as_ref(),
                        respect_none_value: false,
                    });
                }
                match class {
                    ClassAttribute::None => {}
                    ClassAttribute::String(location, value) => {
                        attr_list.push(WriteAttrItem::Attr {
                            prefix: None,
                            name: Cow::Owned(Ident {
                                name: "class".into(),
                                location: location.clone(),
                            }),
                            value: Some(value),
                            respect_none_value: false,
                        });
                    }
                    ClassAttribute::Multiple(list) => {
                        for (prefix_location, name, value) in list {
                            attr_list.push(WriteAttrItem::Attr {
                                prefix: Some(("class", prefix_location.clone())),
                                name: Cow::Borrowed(name),
                                value: value.as_ref(),
                                respect_none_value: true,
                            });
                        }
                    }
                }
                match style {
                    StyleAttribute::None => {}
                    StyleAttribute::String(location, value) => {
                        attr_list.push(WriteAttrItem::Attr {
                            prefix: None,
                            name: Cow::Owned(Ident {
                                name: "style".into(),
                                location: location.clone(),
                            }),
                            value: Some(value),
                            respect_none_value: false,
                        });
                    }
                    StyleAttribute::Multiple(list) => {
                        for (prefix_location, name, value) in list {
                            attr_list.push(WriteAttrItem::Attr {
                                prefix: Some(("style", prefix_location.clone())),
                                name: Cow::Borrowed(name),
                                value: Some(value),
                                respect_none_value: false,
                            });
                        }
                    }
                }
                for attr in attributes.iter() {
                    let prefix = match &attr.prefix {
                        NormalAttributePrefix::None => None,
                        NormalAttributePrefix::Model(prefix_location) => {
                            Some(("model", prefix_location.clone()))
                        }
                    };
                    attr_list.push(WriteAttrItem::Attr {
                        prefix,
                        name: Cow::Borrowed(&attr.name),
                        value: attr.value.as_ref(),
                        respect_none_value: true,
                    });
                }
                for attr in change_attributes.iter() {
                    let prefix = (
                        "change",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::Attr {
                        prefix: Some(prefix),
                        name: Cow::Borrowed(&attr.name),
                        value: attr.value.as_ref(),
                        respect_none_value: false,
                    });
                }
                for attr in worklet_attributes.iter() {
                    let prefix = (
                        "worklet",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::StaticAttr {
                        prefix: Some(prefix),
                        name: &attr.name,
                        value: &attr.value,
                    });
                }
                for attr in generics.iter() {
                    let prefix = (
                        "generic",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::StaticAttr {
                        prefix: Some(prefix),
                        name: &attr.name,
                        value: &attr.value,
                    });
                }
                for attr in extra_attr.iter() {
                    let prefix = (
                        "extra-attr",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::StaticAttr {
                        prefix: Some(prefix),
                        name: &attr.name,
                        value: &attr.value,
                    });
                }
                write_common_attributes_without_slot(&mut attr_list, common);
            }
            ElementKind::Pure {
                children: _,
                slot,
                slot_value_refs,
                let_vars,
            } => {
                stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                stringifier.write_str("block")?;
                write_slot_and_slot_values(stringifier, &mut attr_list, slot, slot_value_refs);
                for attr in let_vars.iter() {
                    let prefix = (
                        "let",
                        attr.prefix_location
                            .as_ref()
                            .unwrap_or(&attr.name.location)
                            .clone(),
                    );
                    attr_list.push(WriteAttrItem::Attr {
                        prefix: Some(prefix),
                        name: Cow::Borrowed(&attr.name),
                        value: attr.value.as_ref(),
                        respect_none_value: false,
                    });
                }
            }
            ElementKind::For {
                list,
                item_name,
                index_name,
                key,
                children,
            } => {
                attr_list.push(WriteAttrItem::NamedAttr {
                    name: "wx:for",
                    location: list.0.clone(),
                    value: &list.1,
                });
                let item_scope_name = stringifier.add_scope(&item_name.1.name);
                if item_scope_name.as_str() != DEFAULT_FOR_ITEM_SCOPE_NAME {
                    attr_list.push(WriteAttrItem::NamedStaticAttr {
                        name: "wx:for-item",
                        location: item_name.0.clone(),
                        value: if item_scope_name != &item_name.1.name {
                            Cow::Owned(StrName {
                                name: item_scope_name.clone(),
                                location: item_name.1.location(),
                            })
                        } else {
                            Cow::Borrowed(&item_name.1)
                        },
                    });
                }
                let index_scope_name = stringifier.add_scope(&index_name.1.name);
                if index_scope_name.as_str() != DEFAULT_FOR_INDEX_SCOPE_NAME {
                    attr_list.push(WriteAttrItem::NamedStaticAttr {
                        name: "wx:for-index",
                        location: index_name.0.clone(),
                        value: if index_scope_name != &index_name.1.name {
                            Cow::Owned(StrName {
                                name: index_scope_name.clone(),
                                location: index_name.1.location(),
                            })
                        } else {
                            Cow::Borrowed(&index_name.1)
                        },
                    });
                }
                if !key.1.name.is_empty() {
                    attr_list.push(WriteAttrItem::NamedStaticAttr {
                        name: "wx:key",
                        location: key.0.clone(),
                        value: Cow::Borrowed(&key.1),
                    });
                }
                if let Some(child) =
                    is_children_single_non_scope_element(&children, !stringifier.minimize())
                {
                    children_merged = true;
                    ElementWithWx::WithWx(child, &attr_list).stringify_write(stringifier)?;
                    attr_list.truncate(0);
                } else {
                    stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                    stringifier.write_str("block")?;
                }
            }
            ElementKind::If { .. } => unreachable!(),
            ElementKind::TemplateRef { target, data } => {
                stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                stringifier.write_str("template")?;
                attr_list.push(WriteAttrItem::NamedAttr {
                    name: "is",
                    location: target.0.clone(),
                    value: &target.1,
                });
                if !data.1.is_empty() {
                    attr_list.push(WriteAttrItem::NamedAttr {
                        name: "data",
                        location: data.0.clone(),
                        value: &data.1,
                    });
                }
            }
            ElementKind::Include { path } => {
                stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                stringifier.write_str("include")?;
                attr_list.push(WriteAttrItem::NamedStaticAttr {
                    name: "src",
                    location: path.0.clone(),
                    value: Cow::Borrowed(&path.1),
                })
            }
            ElementKind::Slot {
                name,
                values,
                common,
            } => {
                stringifier.write_token("<", None, &elem.tag_location.start.0)?;
                stringifier.write_str("slot")?;
                attr_list.extend(wx_items.iter().cloned());
                write_slot_and_slot_values(
                    stringifier,
                    &mut attr_list,
                    &common.slot,
                    &common.slot_value_refs,
                );
                if !name.1.is_empty() {
                    attr_list.push(WriteAttrItem::NamedAttr {
                        name: "name",
                        location: name.0.clone(),
                        value: &name.1,
                    });
                }
                for attr in values.iter() {
                    attr_list.push(WriteAttrItem::Attr {
                        prefix: None,
                        name: Cow::Borrowed(&attr.name),
                        value: attr.value.as_ref(),
                        respect_none_value: false,
                    });
                }
                write_common_attributes_without_slot(&mut attr_list, common);
            }
        }
        if !children_merged {
            stringifier.list(&attr_list)?;
        }

        // write tag body and end
        let empty_children = vec![];
        let children = elem.children().unwrap_or(&empty_children);
        if children_merged {
            // empty
        } else if !is_children_empty(children, !stringifier.minimize()) {
            stringifier.write_token(">", None, &elem.tag_location.start.1)?;
            children_inline_stringify_write(
                children,
                elem.tag_location.start.1.end,
                elem.tag_location
                    .end
                    .as_ref()
                    .unwrap_or(&elem.tag_location.start)
                    .0
                    .start,
                stringifier,
            )?;
            stringifier.write_token(
                "<",
                None,
                &elem
                    .tag_location
                    .end
                    .as_ref()
                    .unwrap_or(&elem.tag_location.start)
                    .0,
            )?;
            stringifier.write_token("/", None, &elem.tag_location.close)?;
            match &elem.kind {
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
                &elem
                    .tag_location
                    .end
                    .as_ref()
                    .unwrap_or(&elem.tag_location.start)
                    .1,
            )?;
        } else {
            stringifier.write_optional_space()?;
            stringifier.write_token("/", None, &elem.tag_location.close)?;
            stringifier.write_token(">", None, &elem.tag_location.start.1)?;
        }

        Ok(())
    }
}

impl StringifyLine for Value {
    fn stringify_write<'s, 't, 'u, W: FmtWrite>(
        &self,
        stringifier: &mut StringifierLine<'s, 't, 'u, W>,
    ) -> FmtResult {
        let write_static_as_dynamic = |x: &str, location, stringifier: &mut StringifierLine<W>| {
            stringifier.write_token_state(
                "{{",
                None,
                location,
                StringifierLineState::DoubleBraceStart,
            )?;
            let quoted = gen_lit_str(x);
            stringifier.write_token_state(
                &format!(r#"{}"#, quoted),
                None,
                location,
                StringifierLineState::Normal,
            )?;
            stringifier.write_token_state(
                "}}",
                None,
                location,
                StringifierLineState::DoubleBraceEnd,
            )?;
            Ok(())
        };
        match self {
            Self::Static { value, location } => {
                if !value.is_empty()
                    && value
                        .chars()
                        .find(|x| !crate::parse::is_template_whitespace(*x))
                        .is_none()
                {
                    write_static_as_dynamic(&value, location, stringifier)?;
                } else {
                    let quoted = escape_html_body(&value);
                    stringifier.write_token(&format!("{}", quoted), None, &location)?;
                }
            }
            Self::Dynamic {
                expression,
                double_brace_location: _,
                binding_map_keys: _,
            } => {
                let need_write_as_dynamic =
                    if let Expression::LitStr { value, location } = &**expression {
                        if !value.is_empty()
                            && value
                                .chars()
                                .find(|x| !crate::parse::is_template_whitespace(*x))
                                .is_none()
                        {
                            Some((value, location))
                        } else {
                            None
                        }
                    } else {
                        None
                    };
                if let Some((value, location)) = need_write_as_dynamic {
                    write_static_as_dynamic(&value, location, stringifier)?;
                } else {
                    expression.for_each_static_or_dynamic_part(|value, location| match value {
                        Expression::LitStr { value, location } => {
                            stringifier.write_token(&escape_html_body(value), None, location)?;
                            return Ok(());
                        }
                        Expression::ToStringWithoutUndefined { value, location } => {
                            stringifier.write_token_state(
                                "{{",
                                None,
                                &location,
                                StringifierLineState::DoubleBraceStart,
                            )?;
                            StringifyLine::stringify_write(&**value, stringifier)?;
                            stringifier.write_token_state(
                                "}}",
                                None,
                                &location,
                                StringifierLineState::DoubleBraceEnd,
                            )?;
                            return Ok(());
                        }
                        _ => {
                            stringifier.write_token_state(
                                "{{",
                                None,
                                &location,
                                StringifierLineState::DoubleBraceStart,
                            )?;
                            StringifyLine::stringify_write(value, stringifier)?;
                            stringifier.write_token_state(
                                "}}",
                                None,
                                &location,
                                StringifierLineState::DoubleBraceEnd,
                            )?;
                            return Ok(());
                        }
                    })?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::stringify::{Stringify, StringifyOptions};

    #[test]
    fn text_node() {
        let src = r#" text <div> text <span/> </div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<!----> text <!---->\n<div>\n    <!----> text <!---->\n    <span />\n</div>\n",
        );
    }

    #[test]
    fn comment_around_text_node() {
        let src = r#"<!----> text <!---->"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(output.as_str(), "<!----> text <!---->\n",);
    }

    #[test]
    fn meta_tag() {
        let src = r#"<!META a={{123}}> <!META data:a="123" data:b="456">"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            line_width_limit: 30,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<!META a=\"{{ 123 }}\">\n<!META\n    data:a=\"123\"\n    data:b=\"456\"\n>\n",
        );
    }

    #[test]
    fn normal_tag() {
        let src = r#"<div a={{123}} /> <div data:a="123" data:b="456" />"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            line_width_limit: 30,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div a=\"{{ 123 }}\" />\n<div\n    data:a=\"123\"\n    data:b=\"456\"\n/>\n",
        );
    }

    #[test]
    fn comment() {
        let src = r#"<div> <!--TEST--> abc </div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div>\n    <!--TEST--> abc <!---->\n</div>\n",
        );
    }

    #[test]
    fn comment_minimized() {
        let src = r#"<div> <!--TEST--> <span /> </div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            minimize: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(output.as_str(), "<div><span/></div>",);
    }

    #[test]
    fn line_end_comments() {
        let src = r#"<div> abc <!-- 1 --> <span /> <!-- 2 --> <span> <!-- 3 --> </span> </div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div>\n    <!----> abc <!-- 1 -->\n    <span /> <!-- 2 -->\n    <span>\n        <!-- 3 -->\n    </span>\n</div>\n",
        );
    }

    #[test]
    fn preserve_empty_lines_between_tags() {
        let src = "<div> \n\n <span /> \n\n <span /> \n\n </div>";
        let (template, _) = crate::parse::parse("TEST", src);
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, Default::default());
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div>\n\n    <span />\n\n    <span />\n\n</div>\n",
        );
    }
}

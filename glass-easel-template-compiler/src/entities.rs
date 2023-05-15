//! Helpers for parsing HTML entities

use entities::ENTITIES;
use std::{collections::HashMap, borrow::Cow};

lazy_static! {
    static ref ENTITIES_MAPPING: HashMap<&'static str, &'static str> = make_mapping();
}

fn make_mapping() -> HashMap<&'static str, &'static str> {
    let mut mapping = HashMap::new();
    for entity in ENTITIES.iter() {
        mapping.insert(entity.entity, entity.characters);
    }
    mapping
}

pub(crate) fn decode<'a>(entity: &'a str) -> Cow<'a, str> {
    dbg!(&entity);
    let len = entity.len();
    if &entity[(len - 1)..] != ";" {
        return Cow::Borrowed(entity);
    }
    if len > 4 && &entity[1..=2] == "#x" {
        let hex_str = &entity[3..(len - 1)];
        if let Ok(hex) = u32::from_str_radix(hex_str, 16) {
            if let Some(c) = char::from_u32(hex) {
                return Cow::Owned(String::from(c));
            }
        }
        return Cow::Borrowed(entity);
    }
    if len > 3 && &entity[1..=1] == "#" {
        let digit_str = &entity[2..(len - 1)];
        if let Ok(hex) = u32::from_str_radix(digit_str, 10) {
            if let Some(c) = char::from_u32(hex) {
                return Cow::Owned(String::from(c));
            }
        }
        return Cow::Borrowed(entity);
    }
    match ENTITIES_MAPPING.get(entity) {
        None => Cow::Borrowed(entity),
        Some(x) => Cow::Borrowed(*x),
    }
}

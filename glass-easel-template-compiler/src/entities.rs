//! Helpers for parsing HTML entities

use entities::ENTITIES;
use std::collections::HashMap;

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

pub(crate) fn decode(entity: &str) -> &str {
    match ENTITIES_MAPPING.get(entity) {
        None => entity,
        Some(x) => *x,
    }
}

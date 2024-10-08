use std::{collections::HashMap, fmt::Write};

use crate::{escape::gen_lit_str, proc_gen::JsFunctionScopeWriter, TmplError};

#[derive(Debug, Clone)]
pub(crate) struct BindingMapCollector {
    overall_disabled: bool,
    fields: HashMap<String, BindingMapField>,
}

#[derive(Debug, Clone)]
pub(crate) enum BindingMapField {
    Mapped(usize),
    Disabled,
}

impl BindingMapCollector {
    pub(crate) fn new() -> Self {
        Self {
            overall_disabled: false,
            fields: HashMap::new(),
        }
    }

    pub(crate) fn disable_all(&mut self) {
        self.overall_disabled = true;
    }

    pub(crate) fn add_field(&mut self, field: &str) -> Option<usize> {
        let x = self
            .fields
            .entry(field.to_owned())
            .or_insert_with(|| BindingMapField::Mapped(0));
        if let BindingMapField::Mapped(x) = x {
            let ret = *x;
            *x += 1;
            return Some(ret);
        }
        None
    }

    pub(crate) fn disable_field(&mut self, field: &str) {
        self.fields
            .insert(field.to_owned(), BindingMapField::Disabled);
    }

    pub(crate) fn get_field(&self, field: &str) -> Option<()> {
        if self.overall_disabled {
            return None;
        }
        self.fields.get(field).and_then(|x| match x {
            BindingMapField::Mapped(_) => Some(()),
            BindingMapField::Disabled => None,
        })
    }

    pub(crate) fn list_fields(&self) -> impl Iterator<Item = (&str, usize)> {
        let overall_disabled = self.overall_disabled;
        self.fields.iter().filter_map(move |(key, field)| {
            if overall_disabled {
                return None;
            }
            match field {
                BindingMapField::Mapped(x) => Some((key.as_str(), *x)),
                BindingMapField::Disabled => None,
            }
        })
    }
}

#[derive(Debug, Clone)]
pub struct BindingMapKeys {
    keys: Vec<(String, usize)>,
}

impl BindingMapKeys {
    pub(crate) fn new() -> Self {
        Self { keys: vec![] }
    }

    pub(crate) fn add(&mut self, key: &str, index: usize) {
        self.keys.push((key.to_string(), index))
    }

    pub(crate) fn is_empty(&self, bmc: &BindingMapCollector) -> bool {
        for (key, _) in self.keys.iter() {
            if bmc.get_field(key).is_some() {
                return false;
            }
        }
        true
    }

    pub(crate) fn to_proc_gen_write_map<W: Write>(
        &self,
        w: &mut JsFunctionScopeWriter<W>,
        bmc: &BindingMapCollector,
        write_expr: impl FnOnce(&mut JsFunctionScopeWriter<W>) -> Result<(), TmplError>,
    ) -> Result<(), TmplError> {
        w.expr_stmt(|w| {
            for (key, index) in self.keys.iter() {
                if bmc.get_field(key).is_some() {
                    write!(w, "A[{}][{}]=", gen_lit_str(key), index)?;
                    continue;
                }
            }
            w.function_args("D,E,T", |w| write_expr(w))?;
            Ok(())
        })?;
        Ok(())
    }
}

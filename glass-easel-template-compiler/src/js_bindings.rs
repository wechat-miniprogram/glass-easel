//! The js interface

#![cfg(feature = "js_bindings")]

use std::str;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use self::parse::{ParseError, ParseErrorLevel};

use super::*;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateParseError {
    is_error: bool,
    level: ParseErrorLevel,
    code: u32,
    message: String,
    path: String,
    start_line: u32,
    start_column: u32,
    end_line: u32,
    end_column: u32,
}

impl From<ParseError> for TemplateParseError {
    fn from(value: ParseError) -> Self {
        Self {
            is_error: value.kind.level() >= ParseErrorLevel::Error,
            level: value.kind.level(),
            code: value.code() as u32,
            message: value.kind.to_string(),
            path: value.path.to_string(),
            start_line: value.location.start.line,
            start_column: value.location.start.utf16_col,
            end_line: value.location.end.line,
            end_column: value.location.end.utf16_col,
        }
    }
}

#[wasm_bindgen]
pub struct TmplGroup {
    group: crate::TmplGroup,
}

fn convert_str_arr<T: ToString>(arr: impl Iterator<Item = T>) -> js_sys::Array {
    let ret = js_sys::Array::new();
    for (index, item) in arr.enumerate() {
        ret.set(index as u32, JsValue::from(item.to_string()));
    }
    ret
}

#[wasm_bindgen]
impl TmplGroup {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            group: crate::TmplGroup::new(),
        }
    }

    #[wasm_bindgen(js_name = newDev)]
    pub fn new_dev() -> Self {
        Self {
            group: crate::TmplGroup::new_dev(),
        }
    }

    /// Compile a template and add it to the group.
    ///
    /// Returns an JavaScript array containing all warnings and errors discovered during the compilation.
    /// Each array item is an `TemplateParseError` .
    ///
    #[wasm_bindgen(js_name = addTmpl)]
    pub fn add_tmpl(&mut self, path: &str, tmpl_str: &str) -> JsValue {
        let path = crate::path::normalize(path);
        let errors = self.group.add_tmpl(&path, tmpl_str);
        let ret: Vec<_> = errors
            .into_iter()
            .map(|x| TemplateParseError::from(x))
            .collect();
        serde_wasm_bindgen::to_value(&ret).unwrap()
    }

    #[wasm_bindgen(js_name = removeTmpl)]
    pub fn remove_tmpl(&mut self, path: &str) -> bool {
        let path = crate::path::normalize(path);
        self.group.remove_tmpl(&path)
    }

    /// Regenerate a template content string for the specified template.
    #[wasm_bindgen(js_name = stringifyTmpl)]
    pub fn stringify_tmpl(&mut self, path: &str) -> Option<String> {
        let path = crate::path::normalize(path);
        self.group.stringify_tmpl(&path)
    }

    #[wasm_bindgen(js_name = addScript)]
    pub fn add_script(&mut self, path: &str, tmpl_str: &str) {
        let path = crate::path::normalize(path);
        self.group.add_script(&path, tmpl_str);
    }

    #[wasm_bindgen(js_name = removeScript)]
    pub fn remove_script(&mut self, path: &str) -> bool {
        let path = crate::path::normalize(path);
        self.group.remove_script(&path)
    }

    #[wasm_bindgen(js_name = "getDirectDependencies")]
    pub fn get_direct_dependencies(&self, path: &str) -> Result<js_sys::Array, JsError> {
        let dependencies = self.group.direct_dependencies(&path)?;
        Ok(convert_str_arr(dependencies))
    }

    #[wasm_bindgen(js_name = "getScriptDependencies")]
    pub fn get_script_dependencies(&self, path: &str) -> Result<js_sys::Array, JsError> {
        let dependencies = self.group.script_dependencies(&path)?;
        Ok(convert_str_arr(dependencies))
    }

    #[wasm_bindgen(js_name = "getInlineScriptModuleNames")]
    pub fn get_inline_script_module_names(&self, path: &str) -> Result<js_sys::Array, JsError> {
        let names = self.group.inline_script_module_names(path)?;
        Ok(convert_str_arr(names))
    }

    #[wasm_bindgen(js_name = "getInlineScriptStartLine")]
    pub fn get_inline_script_start_line(
        &self,
        path: &str,
        module_name: &str,
    ) -> Result<u32, JsError> {
        let start_line = self.group.inline_script_start_line(path, module_name)?;
        Ok(start_line)
    }

    #[wasm_bindgen(js_name = "getInlineScript")]
    pub fn get_inline_script(&self, path: &str, module_name: &str) -> Result<String, JsError> {
        let script = self.group.inline_script_content(&path, &module_name)?;
        Ok(script.to_string())
    }

    #[wasm_bindgen(js_name = "setInlineScript")]
    pub fn set_inline_script(
        &mut self,
        path: &str,
        module_name: &str,
        new_content: &str,
    ) -> Result<(), JsError> {
        self.group
            .set_inline_script_content(&path, &module_name, &new_content)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = "getRuntimeString")]
    pub fn get_runtime_string(&self) -> String {
        self.group.get_runtime_string()
    }

    #[wasm_bindgen(js_name = "setExtraRuntimeScript")]
    pub fn set_extra_runtime_script(&mut self, s: &str) {
        self.group.set_extra_runtime_script(s)
    }

    #[wasm_bindgen(js_name = "getRuntimeVarList")]
    pub fn get_runtime_var_list() -> String {
        crate::TmplGroup::get_runtime_var_list().join(",")
    }

    #[wasm_bindgen(js_name = "getTmplGenObject")]
    pub fn get_tmpl_gen_object(&self, path: &str) -> Result<String, JsError> {
        Ok(self.group.get_tmpl_gen_object(path)?)
    }

    #[wasm_bindgen(js_name = "getTmplGenObjectGroups")]
    pub fn get_tmpl_gen_object_groups(&self) -> Result<String, JsError> {
        Ok(self.group.get_tmpl_gen_object_groups()?)
    }

    #[wasm_bindgen(js_name = "getWxGenObjectGroups")]
    pub fn get_wx_gen_object_groups(&self) -> Result<String, JsError> {
        Ok(self.group.get_wx_gen_object_groups()?)
    }

    #[wasm_bindgen(js_name = "exportGlobals")]
    pub fn export_globals(&self) -> Result<String, JsError> {
        Ok(self.group.export_globals()?)
    }

    #[wasm_bindgen(js_name = "exportAllScripts")]
    pub fn export_all_scripts(&self) -> Result<String, JsError> {
        Ok(self.group.export_all_scripts()?)
    }

    #[wasm_bindgen(js_name = "importGroup")]
    pub fn import_group(&mut self, group: &TmplGroup) {
        self.group.import_group(&group.group)
    }

    #[wasm_bindgen(js_name = "getTmplConvertedExpr")]
    #[doc(hidden)]
    pub fn get_tmpl_converted_expr(
        &mut self,
        path: &str,
        ts_env: &str,
    ) -> Result<TmplConvertedExpr, JsError> {
        let ret = self.group.get_tmpl_converted_expr(path, ts_env)?;
        Ok(ret)
    }
}

#[wasm_bindgen]
pub fn enable_console_log() {
    console_log::init_with_level(log::Level::Debug).unwrap();
}

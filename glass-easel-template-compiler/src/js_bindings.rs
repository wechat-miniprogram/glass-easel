//! The js interface

#![cfg(feature = "js_bindings")]

use wasm_bindgen::prelude::*;

use super::*;

#[wasm_bindgen]
pub struct TmplGroup {
    group: crate::TmplGroup,
    names: Vec<String>,
}

impl From<TmplError> for JsValue {
    fn from(value: TmplError) -> Self {
        JsValue::from(format!("{}", value))
    }
}

impl From<TmplParseError> for JsValue {
    fn from(value: TmplParseError) -> Self {
        JsValue::from(format!("{}", value))
    }
}

fn convert_str_arr(arr: &Vec<String>) -> js_sys::Array {
    let ret = js_sys::Array::new_with_length(arr.len() as u32);
    for item in arr {
        ret.push(&JsValue::from(item));
    }
    ret
}

#[wasm_bindgen]
impl TmplGroup {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            group: crate::TmplGroup::new(),
            names: vec![],
        }
    }

    #[wasm_bindgen(js_name = addTmpl)]
    pub fn add_tmpl(&mut self, path: &str, tmpl_str: &str) -> Result<usize, JsValue> {
        let path = group::path::normalize(path);
        self.group.add_tmpl(&path, tmpl_str)?;
        if let Some(x) = self.names.iter().position(|x| x.as_str() == path.as_str()) {
            Ok(x)
        } else {
            self.names.push(path);
            Ok(self.names.len() - 1)
        }
    }

    #[wasm_bindgen(js_name = addScript)]
    pub fn add_script(&mut self, path: &str, tmpl_str: &str) -> Result<(), JsValue> {
        let path = group::path::normalize(path);
        self.group.add_script(&path, tmpl_str)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = "getDirectDependencies")]
    pub fn get_direct_dependencies(&self, path: &str) -> Result<js_sys::Array, JsValue> {
        let deps = self.group.get_direct_dependencies(&path)?;
        Ok(convert_str_arr(&deps))
    }

    #[wasm_bindgen(js_name = "getInlineScriptModuleNames")]
    pub fn get_inline_script_module_names(&self, path: &str) -> Result<js_sys::Array, JsValue> {
        let names = self.group.get_inline_script_module_names(path)?;
        Ok(convert_str_arr(&names))
    }

    #[wasm_bindgen(js_name = "getInlineScript")]
    pub fn get_inline_script(&self, path: &str, module_name: &str) -> Result<String, JsValue> {
        Ok(self.group.get_inline_script(&path, &module_name)?.to_string())
    }

    #[wasm_bindgen(js_name = "setInlineScript")]
    pub fn set_inline_script(&mut self, path: &str, module_name: &str, new_content: &str) -> Result<(), JsValue> {
        self.group.set_inline_script(&path, &module_name, &new_content)?;
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
    pub fn get_tmpl_gen_object(&self, path: &str) -> Result<String, JsValue> {
        Ok(self.group.get_tmpl_gen_object(path)?)
    }

    #[wasm_bindgen(js_name = "getTmplGenObjectGroups")]
    pub fn get_tmpl_gen_object_groups(&self) -> Result<String, JsValue> {
        Ok(self.group.get_tmpl_gen_object_groups()?)
    }

    #[wasm_bindgen(js_name = "getWxGenObjectGroups")]
    pub fn get_wx_gen_object_groups(&self) -> Result<String, JsValue> {
        Ok(self.group.get_wx_gen_object_groups()?)
    }

    #[wasm_bindgen(js_name = "exportGlobals")]
    pub fn export_globals(&self) -> Result<String, JsValue> {
        Ok(self.group.export_globals()?)
    }

    #[wasm_bindgen(js_name = "exportAllScripts")]
    pub fn export_all_scripts(&self) -> Result<String, JsValue> {
        Ok(self.group.export_all_scripts()?)
    }
}

#[wasm_bindgen]
pub fn enable_console_log() {
    console_log::init_with_level(log::Level::Debug).unwrap();
}

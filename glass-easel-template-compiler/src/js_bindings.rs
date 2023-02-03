//! The js interface

#![cfg(feature = "js_bindings")]

use wasm_bindgen::prelude::*;

use super::*;

#[wasm_bindgen]
pub struct TmplGroup {
    group: crate::TmplGroup,
    names: Vec<String>,
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
    pub fn add_tmpl(&mut self, path: String, tmpl_str: &str) -> Result<usize, JsValue> {
        let path = group::path::normalize(path.as_str());
        self.group
            .add_tmpl(path.clone(), tmpl_str)
            .map_err(|x| JsValue::from(format!("{}", x)))?;
        if let Some(x) = self.names.iter().position(|x| x.as_str() == path.as_str()) {
            Ok(x)
        } else {
            self.names.push(path);
            Ok(self.names.len() - 1)
        }
    }

    #[wasm_bindgen(js_name = "getRuntimeString")]
    pub fn get_runtime_string() -> String {
        crate::TmplGroup::get_runtime_string()
    }

    #[wasm_bindgen(js_name = "getRuntimeVarList")]
    pub fn get_runtime_var_list() -> String {
        crate::TmplGroup::get_runtime_var_list().join(",")
    }

    #[wasm_bindgen(js_name = "getTmplGenObject")]
    pub fn get_tmpl_gen_object(&mut self, path: &str) -> Result<String, JsValue> {
        self.group
            .get_tmpl_gen_object(path)
            .map_err(|x| JsValue::from(format!("{}", x)))
    }

    #[wasm_bindgen(js_name = "getTmplGenObjectGroups")]
    pub fn get_tmpl_gen_object_groups(&mut self) -> Result<String, JsValue> {
        self.group
            .get_tmpl_gen_object_groups()
            .map_err(|x| JsValue::from(format!("{}", x)))
    }

    #[wasm_bindgen(js_name = "getWxGenObjectGroups")]
    pub fn get_wx_gen_object_groups(&mut self) -> Result<String, JsValue> {
        self.group
            .get_wx_gen_object_groups()
            .map_err(|x| JsValue::from(format!("{}", x)))
    }

    #[wasm_bindgen]
    #[cfg(feature = "native_data")]
    pub fn apply_data(&self, id: usize, data: JsValue) -> Result<js_sys::Array, JsValue> {
        let ret = js_sys::Array::new();
        fn handle_node(parent_js_arr: &js_sys::Array, node: TmplDataNode<TmplNativeData>) {
            match node {
                TmplDataNode::Element(mut elem) => {
                    let js_elem = js_sys::Object::new();
                    js_sys::Reflect::set(
                        &js_elem,
                        &JsValue::from("tag"),
                        &JsValue::from_str(elem.tag_name()),
                    )
                    .unwrap();
                    let attr = js_sys::Object::new();
                    js_sys::Reflect::set(&js_elem, &JsValue::from("attr"), &attr).unwrap();
                    elem.iter_attrs(|name, value| {
                        js_sys::Reflect::set(
                            &attr,
                            &JsValue::from(name),
                            &native_data_to_js_value(&value),
                        )
                        .unwrap();
                    });
                    let children = js_sys::Array::new();
                    js_sys::Reflect::set(&js_elem, &JsValue::from("children"), &children).unwrap();
                    elem.iter_children(|node| {
                        handle_node(&children, node);
                    });
                    parent_js_arr.push(&js_elem);
                }
                TmplDataNode::TextNode(n) => {
                    let js_str = JsValue::from_str(n.as_str());
                    parent_js_arr.push(&js_str);
                }
            }
        }
        let data = js_value_to_native_data(data);
        self.group
            .apply_data(self.names[id].as_str(), &data, |node| {
                handle_node(&ret, node);
            })
            .map_err(|x| JsValue::from(format!("{:?}", x)))?;
        Ok(ret)
    }
}

#[wasm_bindgen]
pub fn enable_console_log() {
    console_log::init_with_level(log::Level::Debug).unwrap();
}

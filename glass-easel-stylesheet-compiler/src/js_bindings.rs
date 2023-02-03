//! The js interface

#![cfg(feature = "js_bindings")]

use wasm_bindgen::prelude::*;

use super::*;

#[wasm_bindgen]
pub struct StyleSheetTransformer {
    inner: crate::StyleSheetTransformer,
}

#[wasm_bindgen]
impl StyleSheetTransformer {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str, s: &str, class_prefix: Option<String>, rpx_ratio: f32) -> Self {
        Self {
            inner: crate::StyleSheetTransformer::from_css(
                name,
                s,
                StyleSheetOptions {
                    class_prefix,
                    rpx_ratio,
                },
            ),
        }
    }

    #[wasm_bindgen(js_name = getContent)]
    pub fn get_content(&self) -> String {
        let mut ret = vec![];
        self.inner.write_content(&mut ret).unwrap();
        String::from_utf8(ret).unwrap_or_default()
    }

    #[wasm_bindgen(js_name = toSourceMap)]
    pub fn to_source_map(self) -> String {
        let mut ret = vec![];
        self.inner.write_source_map(&mut ret).unwrap();
        String::from_utf8(ret).unwrap_or_default()
    }
}

#[wasm_bindgen]
pub fn enable_console_log() {
    console_log::init_with_level(log::Level::Debug).unwrap();
}

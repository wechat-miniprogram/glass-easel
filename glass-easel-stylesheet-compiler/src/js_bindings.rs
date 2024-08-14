//! The js interface

#![cfg(feature = "js_bindings")]

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use super::*;
use crate::error::{ParseError, ParseErrorLevel};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StyleSheetParseError {
    is_error: bool,
    level: error::ParseErrorLevel,
    code: u32,
    message: String,
    path: String,
    start_line: u32,
    start_column: u32,
    end_line: u32,
    end_column: u32,
}

impl From<ParseError> for StyleSheetParseError {
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
pub struct StyleSheetTransformer {
    warnings: Vec<ParseError>,
    normal_content: String,
    normal_source_map: String,
    low_priority_content: String,
    low_priority_source_map: String,
}

#[wasm_bindgen]
impl StyleSheetTransformer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        name: &str,
        s: &str,
        class_prefix: Option<String>,
        rpx_ratio: f32,
        convert_host: bool,
    ) -> Self {
        let mut sst = crate::StyleSheetTransformer::from_css(
            name,
            s,
            StyleSheetOptions {
                class_prefix,
                rpx_ratio,
                convert_host,
                ..Default::default()
            },
        );
        let warnings = sst.take_warnings();
        let (normal, low_priority) = sst.output_and_low_priority_output();

        let mut normal_content = String::new();
        normal.write_str(&mut normal_content).unwrap();
        let mut normal_source_map = Vec::new();
        normal.write_source_map(&mut normal_source_map).unwrap();

        let mut low_priority_content = String::new();
        low_priority.write_str(&mut low_priority_content).unwrap();
        let mut low_priority_source_map = Vec::new();
        low_priority
            .write_source_map(&mut low_priority_source_map)
            .unwrap();

        Self {
            warnings,
            normal_content,
            normal_source_map: String::from_utf8(normal_source_map).unwrap(),
            low_priority_content,
            low_priority_source_map: String::from_utf8(low_priority_source_map).unwrap(),
        }
    }

    #[wasm_bindgen(js_name = extractWarnings)]
    pub fn extrace_warnings(&mut self) -> JsValue {
        let ret: Vec<_> = self
            .warnings
            .drain(..)
            .map(|x| StyleSheetParseError::from(x))
            .collect();
        serde_wasm_bindgen::to_value(&ret).unwrap()
    }

    #[wasm_bindgen(js_name = getContent)]
    pub fn get_content(&self) -> String {
        self.normal_content.clone()
    }

    #[wasm_bindgen(js_name = getSourceMap)]
    pub fn get_source_map(&self) -> String {
        self.normal_source_map.clone()
    }

    #[wasm_bindgen(js_name = getLowPriorityContent)]
    pub fn get_low_priority_content(&self) -> String {
        self.low_priority_content.clone()
    }

    #[wasm_bindgen(js_name = getLowPrioritySourceMap)]
    pub fn get_low_priority_source_map(&self) -> String {
        self.low_priority_source_map.clone()
    }
}

#[wasm_bindgen]
pub fn enable_console_log() {
    console_log::init_with_level(log::Level::Debug).unwrap();
}

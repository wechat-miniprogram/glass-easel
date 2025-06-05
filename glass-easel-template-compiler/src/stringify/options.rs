
/// The options for the stringifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StringifyOptions {
    /// Mangling scope names or not.
    pub mangling: bool,

    /// Output minimized code or not.
    /// 
    /// If `true`, most other options are ignored.
    pub minimize: bool,

    /// The tab size to indent.
    pub tab_size: u32,

    /// Use `\t` to indent or not.
    pub use_tab_character: bool,

    /// The preferred max line width.
    /// 
    /// Note that lines may exceed this limit when it is not possible.
    pub line_width_limit: u32,

    /// Ignore spacing information in source code.
    pub ignore_source_spacing: bool,
}

impl Default for StringifyOptions {
    fn default() -> Self {
        Self {
            mangling: false,
            minimize: false,
            tab_size: 4,
            use_tab_character: false,
            line_width_limit: 100,
            ignore_source_spacing: false,
        }
    }
}

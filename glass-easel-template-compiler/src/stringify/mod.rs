pub use sourcemap::SourceMap;

pub use options::StringifyOptions;
pub use stringifier::*;

pub(crate) mod expr;
pub mod options;
mod stringifier;
mod tag;
pub(crate) mod typescript;

fn is_typescript_keyword(s: &str) -> bool {
    const TS_KEYWORDS: [&'static str; 53] = [
        "break", "case", "catch", "class", "const", "continue", "debugger", "default",
        "delete", "do", "else", "export", "extends", "finally", "for", "function",
        "if", "import", "in", "instanceof", "new", "return", "super", "switch",
        "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield",
        "enum", "await", "implements", "interface", "let", "package", "private",
        "protected", "public", "static", "arguments", "eval",
        "type", "namespace", "module", "declare", "as", "is", "keyof", "readonly"
    ];
    TS_KEYWORDS.contains(&s)
}

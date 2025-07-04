/// The options for the stringifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StringifyOptions {
    /// Enable source-map support or not.
    pub source_map: bool,

    /// Mangling scope names or not.
    pub mangling: bool,

    /// Output minimized code or not.
    ///
    /// If `true`, other options about formatting are ignored.
    /// Comments are also skipped.
    pub minimize: bool,

    /// The tab size to indent.
    pub tab_size: u32,

    /// Use `\t` to indent or not.
    pub use_tab_character: bool,

    /// The preferred max line width.
    ///
    /// Note that lines may exceed this limit when it is not possible.
    pub line_width_limit: u32,
}

impl Default for StringifyOptions {
    fn default() -> Self {
        Self {
            source_map: false,
            mangling: false,
            minimize: false,
            tab_size: 4,
            use_tab_character: false,
            line_width_limit: 100,
        }
    }
}

#[cfg(test)]
mod test {
    use crate::stringify::{Stringify, StringifyOptions};

    #[test]
    fn source_map_disabled() {
        let src = r#"<div />"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, sourcemap) = stringifier.finish();
        assert!(sourcemap.is_none());
        assert_eq!(output.as_str(), "<div />\n",);
    }

    #[test]
    fn tab_size() {
        let src = r#"<div><span><a/></span></div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            tab_size: 2,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div>\n  <span>\n    <a />\n  </span>\n</div>\n",
        );
    }

    #[test]
    fn use_tab_character() {
        let src = r#"<div><span><a/></span></div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            use_tab_character: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div>\n\t<span>\n\t\t<a />\n\t</span>\n</div>\n",
        );
    }

    #[test]
    fn line_width_limit() {
        let src = r#"<div data:a="this is a long string"></div><div data:a="but short"></div>"#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            line_width_limit: 30,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, _) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            "<div\n    data:a=\"this is a long string\"\n/>\n<div data:a=\"but short\" />\n",
        );
    }

    #[test]
    fn sourcemap_location_minimized() {
        let src = r#"
            <template is="a" />
            <template name="a">
                <a href="/"> A </a>
            </template>
        "#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            source_map: true,
            minimize: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, sourcemap) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            r#"<template name="a"><a href="/"> A </a></template><template is="a"/>"#
        );
        let mut expects = vec![
            (2, 12, 0, 0, None),
            (2, 22, 0, 10, None),
            (2, 28, 0, 16, Some("a")),
            (3, 16, 0, 19, None),
            (3, 17, 0, 20, Some("a")),
            (3, 19, 0, 22, Some("href")),
            (3, 25, 0, 28, None),
            (3, 27, 0, 30, None),
            (3, 28, 0, 31, None),
            (3, 31, 0, 34, None),
            (3, 32, 0, 35, None),
            (3, 17, 0, 36, None),
            (3, 34, 0, 37, None),
            (4, 12, 0, 38, None),
            (4, 13, 0, 39, None),
            (4, 22, 0, 48, None),
            (1, 12, 0, 49, None),
            (1, 22, 0, 59, Some("is")),
            (1, 26, 0, 63, None),
            (1, 29, 0, 65, None),
            (1, 30, 0, 66, None),
        ]
        .into_iter();
        for token in sourcemap.unwrap().tokens() {
            let token = (
                token.get_src_line(),
                token.get_src_col(),
                token.get_dst_line(),
                token.get_dst_col(),
                token.get_name(),
            );
            assert_eq!(Some(token), expects.next());
        }
        assert!(expects.next().is_none());
    }

    #[test]
    fn sourcemap_location() {
        let src = r#"
            <template is="a" />
            <template name="a">
                <a href="/"> A </a>
            </template>
        "#;
        let (template, _) = crate::parse::parse("TEST", src);
        let options = StringifyOptions {
            source_map: true,
            ..Default::default()
        };
        let mut stringifier =
            crate::stringify::Stringifier::new(String::new(), "test", src, options);
        template.stringify_write(&mut stringifier).unwrap();
        let (output, sourcemap) = stringifier.finish();
        assert_eq!(
            output.as_str(),
            r#"<template name="a">
    <a href="/"> A </a>
</template>

<template is="a" />
"#,
        );
        let mut expects = vec![
            (2, 12, 0, 0, None),
            (2, 22, 0, 10, None),
            (2, 28, 0, 16, Some("a")),
            (3, 16, 1, 4, None),
            (3, 17, 1, 5, Some("a")),
            (3, 19, 1, 7, Some("href")),
            (3, 25, 1, 13, None),
            (3, 27, 1, 15, None),
            (3, 28, 1, 16, None),
            (3, 31, 1, 19, None),
            (3, 32, 1, 20, None),
            (3, 17, 1, 21, None),
            (3, 34, 1, 22, None),
            (4, 12, 2, 0, None),
            (4, 13, 2, 1, None),
            (4, 22, 2, 10, None),
            (1, 12, 4, 0, None),
            (1, 22, 4, 10, Some("is")),
            (1, 26, 4, 14, None),
            (1, 29, 4, 17, None),
            (1, 30, 4, 18, None),
        ]
        .into_iter();
        for token in sourcemap.unwrap().tokens() {
            let token = (
                token.get_src_line(),
                token.get_src_col(),
                token.get_dst_line(),
                token.get_dst_col(),
                token.get_name(),
            );
            assert_eq!(Some(token), expects.next());
        }
        assert!(expects.next().is_none());
    }
}

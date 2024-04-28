use cssparser::{
    BasicParseError, ParseError, ParserInput, ParserState, ToCss, Token, TokenSerializationType,
};
use sourcemap::SourceMapBuilder;
use std::{
    fmt::Write,
    ops::{Deref, DerefMut, Range},
};

pub mod error;
pub mod js_bindings;

struct StepParser<'i, 't, 'a> {
    last_location: ParserState,
    parser: &'a mut cssparser::Parser<'i, 't>,
}

impl<'i, 't, 'a> Deref for StepParser<'i, 't, 'a> {
    type Target = cssparser::Parser<'i, 't>;

    fn deref(&self) -> &Self::Target {
        self.parser
    }
}

impl<'i, 't, 'a> DerefMut for StepParser<'i, 't, 'a> {
    fn deref_mut(&mut self) -> &mut <Self as Deref>::Target {
        self.parser
    }
}

impl<'i, 't, 'a> StepParser<'i, 't, 'a> {
    fn wrap(parser: &'a mut cssparser::Parser<'i, 't>) -> Self {
        Self {
            last_location: parser.state(),
            parser,
        }
    }

    fn position(&self) -> error::Position {
        let loc = self.parser.current_source_location();
        error::Position {
            line: loc.line,
            utf16_col: loc.column - 1,
        }
    }

    fn next(&mut self) -> Result<Token<'i>, BasicParseError<'i>> {
        self.parser.skip_whitespace();
        self.last_location = self.parser.state();
        self.parser.next_including_whitespace().map(|x| x.clone())
    }

    fn next_including_whitespace(&mut self) -> Result<Token<'i>, BasicParseError<'i>> {
        self.last_location = self.parser.state();
        self.parser.next_including_whitespace().map(|x| x.clone())
    }

    pub fn try_parse<F, T, E>(&mut self, thing: F) -> Result<T, E>
    where
        F: FnOnce(&mut StepParser<'i, 't, '_>) -> Result<T, E>,
    {
        self.parser.try_parse(|parser| {
            thing(&mut StepParser {
                last_location: self.last_location.clone(),
                parser,
            })
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct StyleSheetOptions {
    pub class_prefix: Option<String>,
    pub class_prefix_sign: Option<String>,
    pub rpx_ratio: f32,
}

impl Default for StyleSheetOptions {
    fn default() -> Self {
        Self {
            class_prefix: None,
            class_prefix_sign: None,
            rpx_ratio: 750.,
        }
    }
}

pub struct StyleSheetTransformer {
    options: StyleSheetOptions,
    path: String,
    output: String,
    utf16_len: u32,
    prev_ser_type: TokenSerializationType,
    source_map: SourceMapBuilder,
    source_id: u32,
    warnings: Vec<error::ParseError>,
}

impl StyleSheetTransformer {
    pub fn from_css(path: &str, css: &str, options: StyleSheetOptions) -> Self {
        let parser_input = &mut ParserInput::new(css);
        let parser = &mut cssparser::Parser::new(parser_input);
        let mut input = StepParser::wrap(parser);
        let mut source_map = SourceMapBuilder::new(None);
        let source_id = source_map.add_source(path);
        source_map.set_source_contents(source_id, Some(css));

        // construct this
        let mut this = Self {
            options,
            path: path.to_string(),
            output: String::new(),
            utf16_len: 0,
            prev_ser_type: TokenSerializationType::nothing(),
            source_id,
            source_map,
            warnings: vec![],
        };

        // detect option problems
        let err = if let Some(x) = this.options.class_prefix_sign.as_mut() {
            if x.contains("*/") {
                *x = String::new();
                true
            } else {
                false
            }
        } else {
            false
        };
        if err {
            let pos = input.position();
            this.add_warning(error::ParseErrorKind::IllegalComment, pos..pos);
        }

        {
            parse_rules(&mut input, &mut this);
        }
        this
    }

    fn add_warning(&mut self, kind: error::ParseErrorKind, location: Range<error::Position>) {
        self.warnings.push(error::ParseError {
            path: self.path.clone(),
            kind,
            location,
        });
    }

    pub fn write_content(&self, mut w: impl std::io::Write) -> std::io::Result<()> {
        w.write_all(self.output.as_bytes())
    }

    pub fn write_source_map(self, w: impl std::io::Write) -> Result<(), sourcemap::Error> {
        self.source_map.into_sourcemap().to_writer(w)
    }

    fn append_token(&mut self, token: Token, input: &mut StepParser, _src: Option<Token>) {
        let next_ser_type = token.serialization_type();
        if self
            .prev_ser_type
            .needs_separator_when_before(next_ser_type)
        {
            write!(&mut self.output, " ").unwrap();
            self.utf16_len += 1;
        }
        self.prev_ser_type = next_ser_type;
        let output_start_pos = self.output.len();
        token.to_css(&mut self.output).unwrap();
        let start = input.last_location.source_location();
        self.source_map.add_raw(
            0,
            self.utf16_len,
            start.line,
            start.column - 1,
            Some(self.source_id),
            None,
        );
        self.utf16_len += str::encode_utf16(&self.output[output_start_pos..]).count() as u32;
    }

    fn append_token_space_preserved(
        &mut self,
        token: Token,
        input: &mut StepParser,
        src: Option<Token>,
    ) {
        if let Token::WhiteSpace(_) = token {
            self.prev_ser_type = token.serialization_type();
            self.output.push(' ');
            self.utf16_len += 1;
        } else {
            self.append_token(token, input, src);
        }
    }

    fn append_nested_block(&mut self, token: Token, input: &mut StepParser) -> Token<'static> {
        let close = match &token {
            Token::CurlyBracketBlock => Token::CloseCurlyBracket,
            Token::SquareBracketBlock => Token::CloseSquareBracket,
            Token::ParenthesisBlock => Token::CloseParenthesis,
            Token::Function(_) => Token::CloseParenthesis,
            _ => unreachable!(),
        };
        self.append_token(token, input, None);
        close
    }

    fn append_nested_block_close(&mut self, close: Token<'static>, input: &mut StepParser) {
        self.append_token(close, input, None);
    }
}

fn parse_rules(input: &mut StepParser, ss: &mut StyleSheetTransformer) {
    while !input.is_exhausted() {
        if !parse_at_rule(input, ss) {
            parse_qualified_rule(input, ss);
        }
    }
}

fn parse_at_rule(input: &mut StepParser, ss: &mut StyleSheetTransformer) -> bool {
    let r = input.try_parse::<_, _, ParseError<()>>(|input| {
        let next = input.next()?;
        match next {
            Token::AtKeyword(x) => {
                ss.append_token(Token::AtKeyword(x.clone()), input, None);
                Ok(x.to_string())
            }
            _ => return Err(input.new_custom_error(())),
        }
    });
    match r {
        Err(_) => return false,
        Ok(x) => {
            let x: &str = &x;
            let contain_rule_list = matches!(x, "media" | "supports" | "document");
            loop {
                let r = input.try_parse::<_, _, ParseError<()>>(|input| {
                    let next = input.next()?;
                    match next {
                        Token::CurlyBracketBlock => {
                            let close = ss.append_nested_block(next, input);
                            if contain_rule_list {
                                input
                                    .parse_nested_block::<_, (), ()>(|nested_input| {
                                        let input = &mut StepParser::wrap(nested_input);
                                        parse_rules(input, ss);
                                        Ok(())
                                    })
                                    .ok();
                            } else {
                                convert_rpx_in_block(input, ss, None);
                            }
                            ss.append_nested_block_close(close, input);
                            return Ok(false);
                        }
                        Token::SquareBracketBlock
                        | Token::ParenthesisBlock
                        | Token::Function(_) => {
                            let close = ss.append_nested_block(next, input);
                            convert_class_names_and_rpx_in_block(input, ss);
                            ss.append_nested_block_close(close, input);
                        }
                        Token::Semicolon => {
                            ss.append_token(next, input, None);
                            return Ok(false);
                        }
                        next => {
                            ss.append_token(next, input, None);
                        }
                    }
                    Ok(true)
                });
                match r {
                    Ok(cont) => {
                        if !cont {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    }
    true
}

fn parse_qualified_rule(input: &mut StepParser, ss: &mut StyleSheetTransformer) {
    let mut in_class = false;
    let mut has_whitespace = false;
    input.skip_whitespace();
    loop {
        let r = input.try_parse::<_, _, ParseError<()>>(|input| {
            let next = input.next_including_whitespace()?;
            match next {
                Token::CurlyBracketBlock | Token::WhiteSpace(_) => {}
                _ => {
                    if has_whitespace {
                        ss.append_token_space_preserved(Token::WhiteSpace(" "), input, None);
                    }
                }
            }
            has_whitespace = false;
            match next {
                Token::CurlyBracketBlock => {
                    let close = ss.append_nested_block(next, input);
                    convert_rpx_in_block(input, ss, None);
                    ss.append_nested_block_close(close, input);
                    return Ok(false);
                }
                Token::SquareBracketBlock | Token::ParenthesisBlock | Token::Function(_) => {
                    let close = ss.append_nested_block(next, input);
                    convert_class_names_and_rpx_in_block(input, ss);
                    ss.append_nested_block_close(close, input);
                    in_class = false;
                }
                Token::Delim('.') => {
                    ss.append_token_space_preserved(next, input, None);
                    in_class = true;
                }
                Token::Ident(src) => {
                    if in_class {
                        if let Some(content) = ss.options.class_prefix_sign.clone() {
                            ss.append_token(Token::Comment(&content), input, None);
                        }
                    }
                    if in_class && ss.options.class_prefix.is_some() {
                        let s = format!("{}--{}", ss.options.class_prefix.as_ref().unwrap(), src);
                        ss.append_token_space_preserved(
                            Token::Ident(s.as_str().into()),
                            input,
                            Some(Token::Ident(src)),
                        );
                    } else {
                        ss.append_token_space_preserved(Token::Ident(src), input, None);
                    }
                    in_class = false;
                }
                Token::WhiteSpace(_) => {
                    has_whitespace = true;
                    in_class = false;
                }
                next => {
                    ss.append_token_space_preserved(next, input, None);
                    in_class = false;
                }
            }
            Ok(true)
        });
        match r {
            Ok(cont) => {
                if !cont {
                    break;
                }
            }
            Err(_) => break,
        }
    }
}

fn convert_class_names_and_rpx_in_block(input: &mut StepParser, ss: &mut StyleSheetTransformer) {
    input
        .parse_nested_block::<_, (), ()>(|nested_input| {
            let input = &mut StepParser::wrap(nested_input);
            let mut in_class = false;
            let mut has_whitespace = false;
            input.skip_whitespace();
            loop {
                let next = input.next_including_whitespace()?;
                match next {
                    Token::CurlyBracketBlock | Token::WhiteSpace(_) => {}
                    _ => {
                        if has_whitespace {
                            ss.append_token_space_preserved(Token::WhiteSpace(" "), input, None);
                        }
                    }
                }
                has_whitespace = false;
                match next {
                    Token::CurlyBracketBlock
                    | Token::SquareBracketBlock
                    | Token::ParenthesisBlock
                    | Token::Function(_) => {
                        let close = ss.append_nested_block(next, input);
                        convert_class_names_and_rpx_in_block(input, ss);
                        ss.append_nested_block_close(close, input);
                        in_class = false;
                    }
                    Token::Delim('.') => {
                        ss.append_token(next, input, None);
                        in_class = true;
                    }
                    Token::Ident(src) => {
                        if in_class {
                            if let Some(content) = ss.options.class_prefix_sign.clone() {
                                ss.append_token(Token::Comment(&content), input, None);
                            }
                        }
                        if in_class && ss.options.class_prefix.is_some() {
                            let s =
                                format!("{}--{}", ss.options.class_prefix.as_ref().unwrap(), src);
                            ss.append_token(
                                Token::Ident(s.as_str().into()),
                                input,
                                Some(Token::Ident(src)),
                            );
                        } else {
                            ss.append_token(Token::Ident(src), input, None);
                        }
                        in_class = false;
                    }
                    Token::Dimension {
                        has_sign,
                        value,
                        unit,
                        int_value,
                    } => {
                        let unit_str: &str = &unit;
                        if unit_str == "rpx" {
                            let new_value = value * 100. / ss.options.rpx_ratio;
                            let new_int_value =
                                if (new_value.round() - new_value).abs() <= f32::EPSILON {
                                    Some(new_value.round() as i32)
                                } else {
                                    None
                                };
                            let t = Token::Dimension {
                                has_sign,
                                value: new_value,
                                int_value: new_int_value,
                                unit: "vw".into(),
                            };
                            ss.append_token(
                                t,
                                input,
                                Some(Token::Dimension {
                                    has_sign,
                                    value,
                                    unit,
                                    int_value,
                                }),
                            );
                        } else {
                            ss.append_token(
                                Token::Dimension {
                                    has_sign,
                                    value,
                                    unit,
                                    int_value,
                                },
                                input,
                                None,
                            );
                        }
                        in_class = false;
                    }
                    Token::WhiteSpace(_) => {
                        has_whitespace = true;
                        in_class = false;
                    }
                    next => {
                        ss.append_token(next, input, None);
                        in_class = false;
                    }
                }
            }
        })
        .ok();
}

struct ConvertOptions {
    in_calc: bool,
}

fn convert_rpx_in_block(
    input: &mut StepParser,
    ss: &mut StyleSheetTransformer,
    convert_options: Option<ConvertOptions>,
) {
    let mut skip_whitespace = true;
    let mut in_calc = false;
    if let Some(options) = convert_options {
        if options.in_calc {
            skip_whitespace = false;
            in_calc = true;
        }
    }
    input
        .parse_nested_block::<_, (), ()>(|nested_input| {
            let input = &mut StepParser::wrap(nested_input);
            let mut prev_token: Option<Token> = None;
            loop {
                let next = if skip_whitespace {
                    input.next()?
                } else {
                    input.next_including_whitespace()?
                };
                match next.clone() {
                    Token::CurlyBracketBlock
                    | Token::SquareBracketBlock
                    | Token::ParenthesisBlock => {
                        let close = ss.append_nested_block(next.clone(), input);
                        convert_rpx_in_block(input, ss, None);
                        ss.append_nested_block_close(close, input);
                    }
                    Token::Function(func) => {
                        let config = if func == "calc" {
                            Some(ConvertOptions { in_calc: true })
                        } else {
                            None
                        };
                        let close = ss.append_nested_block(next.clone(), input);
                        convert_rpx_in_block(input, ss, config);
                        ss.append_nested_block_close(close, input);
                    }
                    Token::Dimension {
                        has_sign,
                        value,
                        unit,
                        int_value,
                    } => {
                        let unit_str: &str = &unit;
                        if unit_str == "rpx" {
                            let new_value = value * 100. / ss.options.rpx_ratio;
                            let new_int_value =
                                if (new_value.round() - new_value).abs() <= f32::EPSILON {
                                    Some(new_value.round() as i32)
                                } else {
                                    None
                                };
                            let t = Token::Dimension {
                                has_sign,
                                value: new_value,
                                int_value: new_int_value,
                                unit: "vw".into(),
                            };
                            ss.append_token(
                                t,
                                input,
                                Some(Token::Dimension {
                                    has_sign,
                                    value,
                                    unit,
                                    int_value,
                                }),
                            );
                        } else {
                            ss.append_token(
                                Token::Dimension {
                                    has_sign,
                                    value,
                                    unit,
                                    int_value,
                                },
                                input,
                                None,
                            );
                        }
                    }
                    Token::WhiteSpace(_) => {
                        let mut skip = true;
                        if in_calc {
                            // In calc(), the + and - operators must be surrounded by whitespace.
                            // match next token
                            let _ = input.try_parse::<_, (), ()>(|input| {
                                let next_token =
                                    input.next_including_whitespace().map_err(|_| ())?;
                                match next_token {
                                    Token::Delim(c) if c == '+' || c == '-' => {
                                        skip = false;
                                    }
                                    _ => {}
                                }
                                Err(())
                            });
                            // match prev token
                            if let Some(prev_token) = prev_token {
                                match prev_token {
                                    Token::Delim(c) if c == '+' || c == '-' => {
                                        skip = false;
                                    }
                                    _ => {}
                                }
                            }
                        }
                        if !skip {
                            ss.append_token(Token::WhiteSpace(" "), input, None);
                        }
                    }
                    next => {
                        ss.append_token(next, input, None);
                    }
                }
                prev_token = Some(next);
            }
        })
        .ok();
}

#[cfg(test)]
mod test {
    use sourcemap::SourceMap;

    use super::*;

    #[test]
    fn remove_comments() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#" /* test */ .a { } "#,
            StyleSheetOptions {
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            ".a{}"
        );
    }

    #[test]
    fn add_class_prefix() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                #a.b   [g] .c.d g:e(.f) {
                    key: .v f(.c) d.e;
                }
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "#a.p--b [g] .p--c.p--d g:e(.p--f){key:.v f(.c)d.e;}"
        );
    }

    #[test]
    fn allow_class_prefix_sign() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                .a g:e(.f) {}
            "#,
            StyleSheetOptions {
                class_prefix: None,
                class_prefix_sign: Some("TEST".into()),
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "./*TEST*/a g:e(./*TEST*/f){}"
        );
    }

    #[test]
    fn allow_class_prefix_sign_before_prefix() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                .a {}
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                class_prefix_sign: Some("TEST".into()),
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "./*TEST*/p--a{}"
        );
    }

    #[test]
    fn transform_rpx() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                #a.b[1rpx]  (7.5rpx){
                    key: 7.5rpx f(7.5rpx);
                }
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "#a.p--b[0.133333vw] (1vw){key:1vw f(1vw);}"
        );
    }

    #[test]
    fn transform_rpx_in_simple_at_rules() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                @a 75rpx;
                .b {}
                @c (75rpx .d) { 75rpx .e }
                .f {}
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "@a 75rpx;.p--b{}@c(10vw .p--d){10vw.e}.p--f{}"
        );
    }

    #[test]
    fn rules_in_at_media() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                @media (width: 1rpx) {
                    .b [2rpx] {
                        key: 3rpx .a;
                    }
                }
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                rpx_ratio: 10.,
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            "@media(width: 10vw){.p--b [20vw]{key:30vw.a;}}"
        );
    }

    #[test]
    fn minify_calc() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#"
                .a {
                    margin: 10px 20rpx 30px calc(10px + 20px / 2);
                    padding: calc(10rpx  *  2  +  30px);
                }
            "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                rpx_ratio: 10.,
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            ".p--a{margin:10px 200vw 30px calc(10px + 20px/2);padding:calc(100vw*2 + 30px);}"
        );
    }

    #[test]
    fn minify_calc_source_map() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#" .a { padding: calc(10rpx  *  2  +  30px); } "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                rpx_ratio: 10.,
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(
            std::str::from_utf8(&s).unwrap(),
            ".p--a{padding:calc(100vw*2 + 30px);}"
        );
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        let sm: &[u8] = &sm;
        let source_map = SourceMap::from_reader(sm).unwrap();
        {
            let token = source_map.lookup_token(0, 0).unwrap();
            assert_eq!(token.get_name(), None);
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 1);
        }
        {
            let token = source_map.lookup_token(0, 1).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 2);
        }
        {
            let token = source_map.lookup_token(0, 5).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 4);
        }
        {
            let token = source_map.lookup_token(0, 6).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 6);
        }
        {
            let token = source_map.lookup_token(0, 14).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 15);
        }
        {
            let token = source_map.lookup_token(0, 19).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 20);
        }
        {
            let token = source_map.lookup_token(0, 24).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 27);
        }
        {
            let token = source_map.lookup_token(0, 27).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 33);
        }
        {
            let token = source_map.lookup_token(0, 29).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 36);
        }
    }

    #[test]
    fn source_map() {
        let trans = StyleSheetTransformer::from_css(
            "",
            r#" .a { width: 1rpx } "#,
            StyleSheetOptions {
                class_prefix: Some("p".into()),
                rpx_ratio: 10.,
                ..Default::default()
            },
        );
        let mut s = Vec::new();
        trans.write_content(&mut s).unwrap();
        assert_eq!(std::str::from_utf8(&s).unwrap(), ".p--a{width:10vw}");
        let mut sm = Vec::new();
        trans.write_source_map(&mut sm).unwrap();
        let sm: &[u8] = &sm;
        let source_map = SourceMap::from_reader(sm).unwrap();
        {
            let token = source_map.lookup_token(0, 0).unwrap();
            assert_eq!(token.get_name(), None);
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 1);
        }
        {
            let token = source_map.lookup_token(0, 1).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 2);
        }
        {
            let token = source_map.lookup_token(0, 5).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 4);
        }
        {
            let token = source_map.lookup_token(0, 6).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 6);
        }
        {
            let token = source_map.lookup_token(0, 12).unwrap();
            assert_eq!(token.get_src_line(), 0);
            assert_eq!(token.get_src_col(), 13);
        }
    }
}

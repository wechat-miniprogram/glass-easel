use clap::{App, Arg};
use glass_easel_stylesheet_compiler::*;
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
struct CmdArgs {
    interactive: bool,
    input: PathBuf,
    output: Option<PathBuf>,
    sourcemap_output: Option<PathBuf>,
    class_prefix: Option<String>,
    rpx_ratio: f32,
}

fn parse_cmd() -> CmdArgs {
    let matches = App::new("The Stylesheet Compiler for glass-easel")
        .author("wechat-miniprogram")
        .arg(
            Arg::with_name("interactive")
                .short("i")
                .long("interactive")
                .help(r#"Read stylesheet from stdin (SOURCE_FILE is only used as file name)"#),
        )
        .arg(
            Arg::with_name("output-single-file")
                .short("o")
                .long("output-single-file")
                .value_name("FILE")
                .help("Sets output file path")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("sourcemap-output-file")
                .short("s")
                .long("sourcemap-output-file")
                .value_name("FILE")
                .help("Sets sourcemap output file path")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("class-prefix")
                .short("c")
                .long("class-prefix")
                .value_name("PREFIX")
                .help("Sets class prefix")
                .takes_value(true),
        )
        .arg(
            Arg::with_name("rpx-ratio")
                .short("r")
                .long("rpx-ratio")
                .value_name("NUMBER")
                .help("Sets RPX ratio (default to 750)")
                .default_value("750")
                .required(false)
                .takes_value(true),
        )
        .arg(
            Arg::with_name("SOURCE_FILE")
                .help("Sets the source stylesheet file")
                .required(true)
                .index(1),
        )
        .get_matches();

    let interactive = matches.is_present("interactive");
    let output = matches.value_of("output-single-file").map(|x| x.into());
    let sourcemap_output = matches.value_of("sourcemap-output-file").map(|x| x.into());
    let class_prefix = matches.value_of("class-prefix").map(|x| x.into());
    let rpx_ratio = matches
        .value_of("rpx-ratio")
        .unwrap()
        .parse()
        .expect("RPX_RATIO should be a valid number");
    let input = matches.value_of("SOURCE_FILE").unwrap().into();

    CmdArgs {
        interactive,
        input,
        output,
        sourcemap_output,
        class_prefix,
        rpx_ratio,
    }
}

fn main() {
    env_logger::init();
    let args = parse_cmd();
    let options = StyleSheetOptions {
        class_prefix: args.class_prefix.clone(),
        rpx_ratio: args.rpx_ratio,
    };
    let sst = if args.interactive {
        use std::io::Read;
        let mut s = String::new();
        std::io::stdin().read_to_string(&mut s).unwrap();
        StyleSheetTransformer::from_css(
            args.input
                .to_str()
                .expect("SOURCE_FILE name should be valid unicode string"),
            &s,
            options,
        )
    } else {
        let s = fs::read_to_string(&args.input).expect("Failed to read source file");
        StyleSheetTransformer::from_css(
            args.input
                .to_str()
                .expect("SOURCE_FILE name should be valid unicode string"),
            &s,
            options,
        )
    };
    if let Some(output) = args.output {
        let output = fs::File::create(output).expect("Failed to open or create output file");
        sst.write_content(output).unwrap();
    } else {
        let mut s = Vec::new();
        sst.write_content(&mut s).unwrap();
        println!("{}", String::from_utf8(s).unwrap());
    }
    if let Some(sourcemap_output) = args.sourcemap_output {
        let output = fs::File::create(sourcemap_output)
            .expect("Failed to open or create sourcemap output file");
        sst.write_source_map(output).unwrap();
    }
}

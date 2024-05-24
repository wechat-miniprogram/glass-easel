use clap::Parser;
use glass_easel_stylesheet_compiler::*;
use std::fs;
use std::path::PathBuf;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct CmdArgs {
    /// Read stylesheet from stdin (SOURCE_FILE is used as file name)
    #[arg(short, long)]
    interactive: bool,

    /// The source stylesheet file
    #[arg(value_name = "SOURCE_FILE")]
    input: PathBuf,

    /// The output file
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// The output source-map file
    #[arg(short, long)]
    sourcemap_output: Option<PathBuf>,

    /// The class prefix that should be added to class names (`--` not included)
    #[arg(short, long)]
    class_prefix: Option<String>,

    /// A comment message inserted in where the class prefix should be added
    #[arg(long)]
    class_prefix_sign: Option<String>,

    /// The RPX ratio
    #[arg(short, long, default_value = "750.")]
    rpx_ratio: f32,

    /// A comment message inserted in where the import content should be added
    #[arg(long)]
    import_sign: Option<String>,
}

fn main() {
    env_logger::init();
    let args = CmdArgs::parse();
    let options = StyleSheetOptions {
        class_prefix: args.class_prefix.clone(),
        class_prefix_sign: args.class_prefix_sign.clone(),
        rpx_ratio: args.rpx_ratio,
        import_sign: args.import_sign.clone(),
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

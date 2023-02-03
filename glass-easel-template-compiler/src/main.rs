#[macro_use]
extern crate log;

use clap::{App, Arg};
use glass_easel_template_compiler::*;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
struct CmdArgs {
    interactive: bool,
    input: Option<PathBuf>,
    output: Option<PathBuf>,
    target: TargetType,
}

#[derive(Debug)]
enum TargetType {
    WxGenObject,
    Wxml,
}

fn parse_cmd() -> CmdArgs {
    let matches = App::new("The Template Compiler for glass-easel")
        .author("wechat-miniprogram")
        .arg(
            Arg::with_name("interactive")
                .short("i")
                .long("interactive")
                .help(r#"Read template from stdin (DIRECTORY is ignored)"#),
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
            Arg::with_name("target")
                .short("t")
                .long("target")
                .takes_value(true)
                .possible_values(&["gen-object", "wxml"])
                .help("Compiling target"),
        )
        .arg(
            Arg::with_name("DIRECTORY")
                .help("Sets the root directory of WXML files")
                .required_unless("interactive")
                .index(1),
        )
        .get_matches();

    let interactive = matches.is_present("interactive");
    let output = matches.value_of("output-single-file").map(|x| x.into());
    let target = match matches.value_of("target").unwrap_or("gen-object") {
        "gen-object" => TargetType::WxGenObject,
        "wxml" => TargetType::Wxml,
        _ => unreachable!(),
    };
    let input = matches.value_of("DIRECTORY").map(|x| x.into());

    CmdArgs {
        interactive,
        input,
        output,
        target,
    }
}

fn load_wxml_files(group: &mut TmplGroup, dir: &Path, wxml_path: &mut Vec<String>) -> u64 {
    trace!("Search in path: {}", dir.to_str().unwrap_or(""));
    let mut size = 0;
    match fs::read_dir(dir) {
        Err(_) => {
            warn!("List dir failed: {}", dir.to_str().unwrap_or(""));
        }
        Ok(list) => {
            for entry in list {
                match entry {
                    Err(_) => {
                        warn!("Get path failed: {}", dir.to_str().unwrap_or(""));
                    }
                    Ok(entry) => {
                        let path = entry.path();
                        let fsize = entry.metadata().unwrap().len();
                        if path.is_dir() {
                            wxml_path.push(entry.file_name().to_str().unwrap().into());
                            size += load_wxml_files(group, &path, wxml_path);
                            wxml_path.pop();
                        } else if path
                            .extension()
                            .map(|x| x.to_str().unwrap_or(""))
                            .unwrap_or("")
                            == "wxml"
                        {
                            match fs::read_to_string(&path) {
                                Err(_) => {
                                    warn!("Read wxml failed: {}", path.to_str().unwrap_or(""));
                                }
                                Ok(content) => {
                                    trace!("Found wxml file: {}", path.to_str().unwrap_or(""));
                                    wxml_path.push(
                                        entry
                                            .path()
                                            .file_stem()
                                            .unwrap()
                                            .to_str()
                                            .unwrap()
                                            .to_string(),
                                    );
                                    group.add_tmpl(wxml_path.join("/"), &content).unwrap();
                                    wxml_path.pop();
                                    size += fsize;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    size
}

fn main() {
    env_logger::init();
    let args = parse_cmd();
    let mut group = TmplGroup::new();
    let size = if args.interactive {
        use std::io::Read;
        let mut s = String::new();
        std::io::stdin().read_to_string(&mut s).unwrap();
        group.add_tmpl("".into(), &s).unwrap();
        s.len() as u64
    } else {
        load_wxml_files(
            &mut group,
            &args.input.unwrap_or(std::env::current_dir().unwrap()),
            &mut vec![],
        )
    };
    let s = match args.target {
        TargetType::WxGenObject => {
            let s = group.get_wx_gen_object_groups().unwrap();
            trace!(
                "Generated GenObject. {} bytes read. {} bytes generated.",
                size,
                s.len()
            );
            s
        }
        TargetType::Wxml => {
            let s = format!("{:?}", group);
            trace!(
                "Generated WXML. {} bytes read. {} bytes generated.",
                size,
                s.len()
            );
            s
        }
    };
    if let Some(output) = args.output {
        fs::write(output, s).unwrap();
    } else {
        println!("{}", s);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_loads_wxml_files() {
        let test_dir =
            std::env::temp_dir().join("glass_easel_template_compiler_tests_load_wxml_files");

        if test_dir.exists() {
            fs::remove_dir_all(&test_dir).unwrap();
        }
        fs::create_dir(&test_dir).unwrap();
        fs::write(test_dir.join("index.wxml"), "").unwrap();
        fs::create_dir(test_dir.join("components")).unwrap();
        fs::write(test_dir.join("components").join("common.wxml"), "").unwrap();
        fs::create_dir(test_dir.join("templates")).unwrap();
        fs::write(test_dir.join("templates").join("header.wxml"), "").unwrap();

        let mut group = TmplGroup::new();
        load_wxml_files(&mut group, &test_dir, &mut vec![]);

        assert_eq!(group.len(), 3);
        assert!(group.contains_template("index"));
        assert!(group.contains_template("components/common"));
        assert!(group.contains_template("templates/header"));

        fs::remove_dir_all(test_dir).unwrap();
    }
}

#[allow(unused_imports)]
#[macro_use]
extern crate log;
extern crate pest;
#[macro_use]
extern crate pest_derive;
#[macro_use]
extern crate lazy_static;
#[cfg(feature = "native_data_from_json")]
extern crate serde_json;

mod tree;
pub use tree::TmplTree;
pub(crate) use tree::*;
mod expr;
pub(crate) use expr::*;
mod parser;
pub use parser::*;
mod group;
pub use group::*;
mod binding_map;
mod entities;
mod escape;
mod js_bindings;
pub use js_bindings::*;
#[cfg(feature = "c_bindings")]
pub mod cbinding;
mod proc_gen;

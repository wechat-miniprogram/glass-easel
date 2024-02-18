#[allow(unused_imports)]
#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

mod tree;
pub use tree::TmplTree;
pub(crate) use tree::*;
mod expr;
pub(crate) use expr::*;
mod parser;
mod group;
pub use group::*;
mod binding_map;
mod entities;
mod escape;
mod js_bindings;
#[cfg(feature = "c_bindings")]
pub mod cbinding;
mod proc_gen;

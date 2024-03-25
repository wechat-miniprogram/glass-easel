#[allow(unused_imports)]
#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

pub mod parse;
pub mod stringify;
mod binding_map;
mod group;
pub use group::*;
mod path;
mod entities;
mod escape;
mod js_bindings;
#[cfg(feature = "c_bindings")]
// pub mod cbinding; // TODO !!!
mod proc_gen;

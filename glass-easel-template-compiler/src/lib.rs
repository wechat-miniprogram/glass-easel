#![allow(clippy::needless_borrow)]

#[allow(unused_imports)]
#[macro_use]
extern crate log;
#[macro_use]
extern crate lazy_static;

mod binding_map;
mod group;
pub mod parse;
pub mod stringify;
pub use group::*;
#[cfg(feature = "c_bindings")]
pub mod cbinding;
mod entities;
mod escape;
mod js_bindings;
mod path;
mod proc_gen;
mod typescript;

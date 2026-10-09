#![doc = include_str!("../README.md")]
//!
//! The FFI boundary is deliberately coarse: bindings exchange JSON
//! strings, see [`api`].

pub mod api;
pub mod error;
pub mod eval;
pub mod expression;
pub mod ir;
pub mod number;
pub mod plan;
pub mod value;

pub use error::{Error, ErrorCode, Result};
pub use eval::Predicate;
pub use ir::{Condition, LeafValue};
pub use plan::{CaseSensitive, PlanOptions};

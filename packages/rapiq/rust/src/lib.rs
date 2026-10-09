#![cfg_attr(feature = "core", doc = include_str!("../README.md"))]
//! Umbrella crate of rapiq; enable the features of the parts you need.

/// The core: query IR, expression parser, in-memory filter evaluation.
#[cfg(feature = "core")]
pub use rapiq_core as core;

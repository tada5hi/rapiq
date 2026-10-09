//! Node.js binding for `rapiq-core` (napi-rs).
//!
//! The boundary is JSON strings in and out: one serialization per call
//! instead of one object conversion per IR node. A failure surfaces as
//! a JS `Error` whose `code` is the rapiq `ErrorCode` value
//! (`syntaxInvalid`, `featureUnsupported`, ...).

use napi::Result;
use napi_derive::napi;
use rapiq_binding_support::ErrorPayload;
use rapiq_core::api;

fn to_js(error: rapiq_core::Error) -> napi::Error<String> {
    let payload = ErrorPayload::from(error);

    napi::Error::new(payload.code.to_string(), payload.message)
}

/// `ExpressionFiltersParser.parse()` (schemaless): IR JSON of the root
/// group. An absent input yields an empty AND group.
#[napi]
pub fn parse_expression_filters(input: Option<String>) -> Result<String, String> {
    api::parse_expression_filters(input.as_deref()).map_err(to_js)
}

/// `ExpressionFiltersParser.parseExact()` (schemaless): IR JSON of the
/// raw expression tree.
#[napi]
pub fn parse_expression_filters_exact(input: String) -> Result<String, String> {
    api::parse_expression_filters_exact(&input).map_err(to_js)
}

/// One-shot evaluation: does the record satisfy the filters?
#[napi]
pub fn matches(filters: String, record: String, options: Option<String>) -> Result<bool, String> {
    api::matches(&filters, &record, options.as_deref()).map_err(to_js)
}

/// A filter tree compiled once, evaluated many times.
#[napi]
pub struct Predicate {
    inner: rapiq_core::Predicate,
}

#[napi]
impl Predicate {
    #[napi(constructor)]
    pub fn new(filters: String, options: Option<String>) -> Result<Self, String> {
        let inner = api::compile(&filters, options.as_deref()).map_err(to_js)?;

        Ok(Self { inner })
    }

    /// Test one record (JSON).
    #[napi]
    pub fn test(&self, record: String) -> Result<bool, String> {
        api::test_record(&self.inner, &record).map_err(to_js)
    }

    /// Positions of the records (a JSON array) satisfying the predicate.
    #[napi]
    pub fn filter_indices(&self, records: String) -> Result<Vec<u32>, String> {
        api::matching_indices(&self.inner, &records).map_err(to_js)
    }
}

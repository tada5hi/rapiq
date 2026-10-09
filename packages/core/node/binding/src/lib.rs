//! Node.js binding of `rapiq-core` (napi-rs), loaded by `@rapiq/core`.
//!
//! JSON strings in and out: one serialization per call instead of one
//! object conversion per IR node.
//!
//! - The functions `@rapiq/core` calls internally (`planCondition`,
//!   `distributeNegation`) return an envelope
//!   (`{"ok":true,"value":...}` / `{"ok":false,"error":{code,message,subject}}`)
//!   so the TypeScript side can rebuild the exact typed error, including the
//!   factory argument (`AdapterError.featureUnsupported(feature)`).
//! - The expression parser and the evaluator (proof of concept, used by the
//!   conformance suite) throw a JS `Error` whose `code` is the rapiq
//!   `ErrorCode` value.

#[cfg(feature = "conformance")]
use napi::Result;
use napi_derive::napi;
#[cfg(feature = "conformance")]
use rapiq_binding_support::ErrorPayload;
use rapiq_binding_support::envelope;
use rapiq_core::api;

#[cfg(feature = "conformance")]
fn to_js(error: rapiq_core::Error) -> napi::Error<String> {
    let payload = ErrorPayload::from(error);

    napi::Error::new(payload.code.to_string(), payload.message)
}

/// `planCondition`: condition IR JSON (values may be host references) to
/// an envelope around `ConditionPlan` JSON (`null` for an empty tree).
#[napi]
pub fn plan_condition(condition: String, options: Option<String>) -> String {
    envelope(api::plan_condition(&condition, options.as_deref()))
}

/// `distributeNegation`: envelope around the distributed `ConditionPlan`.
#[napi]
pub fn distribute_negation(plan: String) -> String {
    envelope(api::distribute_negation(&plan))
}

/// `FILTER_OPERATOR_SEMANTICS` as JSON.
#[napi]
pub fn operator_semantics() -> String {
    api::operator_semantics()
}

/// `ExpressionFiltersParser.parse()` (schemaless): IR JSON of the root
/// group. An absent input yields an empty AND group.
#[cfg(feature = "conformance")]
#[napi]
pub fn parse_expression_filters(input: Option<String>) -> Result<String, String> {
    api::parse_expression_filters(input.as_deref()).map_err(to_js)
}

/// `ExpressionFiltersParser.parseExact()` (schemaless): IR JSON of the
/// raw expression tree.
#[cfg(feature = "conformance")]
#[napi]
pub fn parse_expression_filters_exact(input: String) -> Result<String, String> {
    api::parse_expression_filters_exact(&input).map_err(to_js)
}

/// One-shot evaluation: does the record satisfy the filters?
#[cfg(feature = "conformance")]
#[napi]
pub fn matches(filters: String, record: String, options: Option<String>) -> Result<bool, String> {
    api::matches(&filters, &record, options.as_deref()).map_err(to_js)
}

/// A filter tree compiled once, evaluated many times.
#[cfg(feature = "conformance")]
#[napi]
pub struct Predicate {
    inner: rapiq_core::Predicate,
}

#[cfg(feature = "conformance")]
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

//! wasm-bindgen build of the surface `@rapiq/core` calls in browsers
//! (`planCondition`, `distributeNegation`, `operatorSemantics`), with the
//! same envelope as the napi binding.
//!
//! Not shipped: rapiq ships napi's `wasm32-wasip1` build (D2). This crate
//! is built in CI so the browser payload of both toolchains can be compared
//! as more of the core is exposed (measured 2026-10-09: ~76 KB versus
//! ~184 KB gzip including glue).

use rapiq_binding_support::envelope;
use rapiq_core::api;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = planCondition)]
pub fn plan_condition(condition: &str, options: Option<String>) -> String {
    envelope(api::plan_condition(condition, options.as_deref()))
}

#[wasm_bindgen(js_name = distributeNegation)]
pub fn distribute_negation(plan: &str) -> String {
    envelope(api::distribute_negation(plan))
}

#[wasm_bindgen(js_name = operatorSemantics)]
pub fn operator_semantics() -> String {
    api::operator_semantics()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plans_through_the_envelope() {
        let plan = plan_condition(
            r#"{"type":"filter","operator":"gt","field":"a","value":1}"#,
            None,
        );
        assert!(plan.starts_with(r#"{"ok":true,"value":{"kind":"compare""#));
    }
}

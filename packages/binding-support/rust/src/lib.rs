//! Support shared by every rapiq language binding (napi-rs, PyO3, later
//! JNI).
//!
//! - **Global allocator.** With the default `mimalloc` feature, linking this
//!   crate makes mimalloc the allocator of the final binary (not on wasm).
//!   The evaluator allocates heavily (JSON decoding, binding contexts), and
//!   the spike measured it at about half the time with mimalloc. A binding
//!   must reference the crate (`use rapiq_binding_support as _;` or any item)
//!   so the linker keeps it.
//! - **Error payload.** [`ErrorPayload`] is the one shape every binding turns
//!   a [`rapiq_core::Error`] into, so the `code` a host sees is identical
//!   across languages.

#[cfg(all(feature = "mimalloc", not(target_family = "wasm")))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// The host-facing form of a [`rapiq_core::Error`]: the rapiq `ErrorCode`
/// value (`syntaxInvalid`, `featureUnsupported`, ...) and the message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ErrorPayload {
    pub code: &'static str,
    pub message: String,
    /// The argument of the matching TypeScript error factory (feature,
    /// operator, key), when the error has one.
    pub subject: Option<String>,
}

impl From<rapiq_core::Error> for ErrorPayload {
    fn from(error: rapiq_core::Error) -> Self {
        Self {
            code: error.code.as_str(),
            message: error.message,
            subject: error.subject,
        }
    }
}

impl ErrorPayload {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "code": self.code,
            "message": self.message,
            "subject": self.subject,
        })
    }
}

/// Wrap the result of a JSON-returning API call into the envelope a host
/// unpacks without exception plumbing: `{"ok":true,"value":<json>}` or
/// `{"ok":false,"error":{"code","message","subject"}}`. The value is
/// spliced in as is (it already is JSON), not re-serialized.
pub fn envelope(result: rapiq_core::Result<String>) -> String {
    match result {
        Ok(value) => format!("{{\"ok\":true,\"value\":{value}}}"),
        Err(error) => serde_json::json!({
            "ok": false,
            "error": ErrorPayload::from(error).to_json(),
        })
        .to_string(),
    }
}

/// Whether mimalloc is the global allocator of this build.
pub const fn uses_mimalloc() -> bool {
    cfg!(all(feature = "mimalloc", not(target_family = "wasm")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_carries_the_error_code() {
        let error = rapiq_core::expression::parse_exact("eq(").unwrap_err();
        let payload = ErrorPayload::from(error);

        assert_eq!(payload.code, "syntaxInvalid");
        assert!(payload.message.starts_with("The input syntax is invalid"));
    }

    #[test]
    fn envelope_wraps_values_and_errors() {
        assert_eq!(
            envelope(Ok("{\"a\":1}".to_string())),
            "{\"ok\":true,\"value\":{\"a\":1}}"
        );

        let error = envelope(Err(rapiq_core::Error::feature_unsupported("filters:mod")));
        let error: serde_json::Value = serde_json::from_str(&error).unwrap();
        assert_eq!(error["ok"], false);
        assert_eq!(error["error"]["code"], "featureUnsupported");
        assert_eq!(error["error"]["subject"], "filters:mod");
    }

    #[test]
    fn allocator_is_active_by_default() {
        assert!(uses_mimalloc());
        // an allocation through the global allocator works
        assert_eq!(vec![1u8; 1024].len(), 1024);
    }
}

//! Typed errors mirroring `@rapiq/core`'s `ErrorCode` vocabulary.
//!
//! Only the codes the ported slice can raise exist here. The string
//! form of every code is the exact wire value of its TypeScript
//! counterpart, so a binding can surface the same `code` property.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCode {
    InputInvalid,
    SyntaxInvalid,
    KeyInvalid,
    KeyValueInvalid,
    OperatorUnsupported,
    FeatureUnsupported,
    ConditionDetached,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCode::InputInvalid => "inputInvalid",
            ErrorCode::SyntaxInvalid => "syntaxInvalid",
            ErrorCode::KeyInvalid => "keyInvalid",
            ErrorCode::KeyValueInvalid => "keyValueInvalid",
            ErrorCode::OperatorUnsupported => "operatorUnsupported",
            ErrorCode::FeatureUnsupported => "featureUnsupported",
            ErrorCode::ConditionDetached => "conditionDetached",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
}

impl Error {
    fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn input_invalid() -> Self {
        Self::new(
            ErrorCode::InputInvalid,
            "The shape of the input is not valid.",
        )
    }

    pub fn syntax_invalid(details: impl AsRef<str>) -> Self {
        Self::new(
            ErrorCode::SyntaxInvalid,
            format!("The input syntax is invalid: {}", details.as_ref()),
        )
    }

    pub fn key_invalid(key: &str) -> Self {
        Self::new(ErrorCode::KeyInvalid, format!("The key {key} is invalid."))
    }

    pub fn key_value_invalid(key: &str) -> Self {
        Self::new(
            ErrorCode::KeyValueInvalid,
            format!("The value of the key {key} is invalid."),
        )
    }

    pub fn operator_unsupported(operator: &str) -> Self {
        Self::new(
            ErrorCode::OperatorUnsupported,
            format!("The filter operator {operator} is not supported."),
        )
    }

    pub fn feature_unsupported(feature: &str) -> Self {
        Self::new(
            ErrorCode::FeatureUnsupported,
            format!("The feature {feature} is not supported by the dialect."),
        )
    }

    pub fn condition_detached(operator: Option<&str>) -> Self {
        let label = operator.map(|op| format!(" ({op})")).unwrap_or_default();

        Self::new(
            ErrorCode::ConditionDetached,
            format!("The condition{label} cannot be lowered by this built-in consumer."),
        )
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({})", self.message, self.code)
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;

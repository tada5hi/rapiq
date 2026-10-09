//! Value semantics of `@rapiq/adapter-memory`'s `helpers/value.ts`,
//! over JSON values.
//!
//! JSON has a single absent value (`null`), which is exactly the
//! null-unification the TypeScript helpers perform. It has no `Date`,
//! so the date alignment of the TypeScript helpers does not apply.

use std::cmp::Ordering;

use serde_json::Value;

use crate::number::js_number_to_string;

/// Own property of a record-like parent; anything else (null,
/// scalars, arrays) resolves to the absent value.
pub fn resolve_property<'a>(parent: &'a Value, name: &str) -> &'a Value {
    match parent {
        Value::Object(object) => object.get(name).unwrap_or(&Value::Null),
        _ => &Value::Null,
    }
}

/// Deep value equality (`smob.isEqual`): numbers by value, arrays by
/// position, objects by key set and member equality.
pub fn is_value_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        (Value::String(x), Value::String(y)) => x == y,
        (Value::Array(x), Value::Array(y)) => {
            x.len() == y.len() && x.iter().zip(y).all(|(l, r)| is_value_equal(l, r))
        }
        (Value::Object(x), Value::Object(y)) => {
            x.len() == y.len()
                && x.iter()
                    .all(|(key, l)| y.get(key).is_some_and(|r| is_value_equal(l, r)))
        }
        _ => false,
    }
}

/// Three-way comparison of two values of the same comparable type
/// (number, string, boolean); `None` marks the pair incomparable.
///
/// Strings compare by UTF-16 code units, like JavaScript's `<`, not by
/// code points (they differ for characters above U+FFFF against
/// characters in U+E000..U+FFFF).
pub fn compare_values(a: &Value, b: &Value) -> Option<Ordering> {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64()?.partial_cmp(&y.as_f64()?),
        (Value::String(x), Value::String(y)) => Some(x.encode_utf16().cmp(y.encode_utf16())),
        (Value::Bool(x), Value::Bool(y)) => Some(x.cmp(y)),
        _ => None,
    }
}

/// Textual form of a value for string matching; `None` marks the
/// value non-textual.
pub fn to_text(value: &Value) -> Option<std::borrow::Cow<'_, str>> {
    match value {
        Value::String(s) => Some(std::borrow::Cow::Borrowed(s)),
        Value::Number(n) => n
            .as_f64()
            .map(|n| std::borrow::Cow::Owned(js_number_to_string(n))),
        _ => None,
    }
}

/// JavaScript string conversion (`` `${value}` ``).
pub fn js_to_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map(js_number_to_string).unwrap_or_default(),
        Value::String(s) => s.clone(),
        Value::Array(items) => items
            .iter()
            .map(|item| match item {
                Value::Null => String::new(),
                other => js_to_string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_string(),
    }
}

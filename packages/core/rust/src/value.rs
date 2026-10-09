//! Value semantics of `@rapiq/adapter-memory`'s `helpers/value.ts`,
//! over JSON values.
//!
//! JSON has a single absent value (`null`), which is exactly the
//! null-unification the TypeScript helpers perform. It has no `Date`,
//! so the date alignment of the TypeScript helpers does not apply.

use std::cmp::Ordering;

use serde_json::{Map, Value};

use crate::number::js_number_to_string;

/// Key marking a host value reference.
///
/// A host whose values are richer than JSON (JavaScript: `Date`, `RegExp`,
/// `bigint`, `NaN`, `-0`, class instances) sends such a value as an object
/// `{ "$rapiq.ref": <id>, "type": ..., "text": ..., "truthy": ... }` and
/// keeps the original itself. The lowering reads only the facts it needs
/// from the descriptor and echoes it untouched into the plan, where the
/// host swaps the original back in. Fields:
///
/// - `type`: the host type (`date`, `regexp`, `number`, `bigint`, `object`, ...)
/// - `text`: the host's string conversion (`String(value)`)
/// - `truthy`: the host's truthiness (`!!value`)
/// - `number`: the numeric value when it is finite (only `-0` needs this)
/// - `source`, `flags`: for `type: "regexp"`
/// - `operator`: a string `operator` property, if any (detached conditions)
pub const HOST_REF_KEY: &str = "$rapiq.ref";

/// The descriptor of a host value reference, if `value` is one.
pub fn host_ref(value: &Value) -> Option<&Map<String, Value>> {
    value
        .as_object()
        .filter(|object| object.contains_key(HOST_REF_KEY))
}

/// JavaScript truthiness (`!!value`) of a JSON value or host reference.
pub fn js_truthy(value: &Value) -> bool {
    if let Some(descriptor) = host_ref(value) {
        return descriptor
            .get("truthy")
            .and_then(Value::as_bool)
            .unwrap_or(true);
    }

    match value {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// The finite number a value denotes (`typeof value === 'number' &&
/// Number.isFinite(value)`), including a host `-0`.
pub fn js_number(value: &Value) -> Option<f64> {
    if let Some(descriptor) = host_ref(value) {
        if descriptor.get("type").and_then(Value::as_str) != Some("number") {
            return None;
        }

        return descriptor.get("number").and_then(Value::as_f64);
    }

    value.as_f64()
}

/// Source and flags of a host regular expression.
pub fn js_regexp(value: &Value) -> Option<(&str, &str)> {
    let descriptor = host_ref(value)?;
    if descriptor.get("type").and_then(Value::as_str) != Some("regexp") {
        return None;
    }

    Some((
        descriptor.get("source").and_then(Value::as_str)?,
        descriptor
            .get("flags")
            .and_then(Value::as_str)
            .unwrap_or(""),
    ))
}

/// The string `operator` property of an object-shaped value (a detached
/// condition), for host references and plain JSON objects alike.
pub fn condition_operator(value: &Value) -> Option<&str> {
    value.as_object()?.get("operator")?.as_str()
}

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
    if let Some(descriptor) = host_ref(value) {
        return descriptor
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("[object Object]")
            .to_string();
    }

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

//! The serialized filter IR: the language-neutral form of
//! `@rapiq/core`'s `Filters` / `Filter` condition tree.
//!
//! JSON shape (an explicit `type` discriminant, so no consumer has to
//! infer the node kind from the keys present):
//!
//! ```json
//! { "type": "filters", "operator": "and", "value": [ ... ] }
//! { "type": "filter", "operator": "eq", "field": "name", "value": "admin" }
//! { "type": "filter", "operator": "elemMatch", "field": "items",
//!   "value": { "type": "filter", "operator": "eq", "field": "name", "value": "x" } }
//! ```
//!
//! Operators stay strings, exactly like the TypeScript classes accept
//! any operator at construction time: an unknown one is refused by the
//! lowering (`operatorUnsupported`), not by the decoder.

use serde::ser::{Serialize, SerializeMap, Serializer};
use serde_json::{Map, Value};

use crate::error::{Error, Result};

#[derive(Debug, Clone, PartialEq)]
pub enum Condition {
    /// `Filters`: an and/or/not group.
    Compound {
        operator: String,
        children: Vec<Condition>,
    },
    /// `Filter`: a field/operator/value leaf.
    Leaf {
        operator: String,
        field: String,
        value: LeafValue,
    },
    /// A condition the host cannot express in the IR (a custom
    /// `ICondition` kind). Opaque: the lowering refuses it as
    /// `conditionDetached`, exactly like the TypeScript lowering does.
    Custom { operator: Option<String> },
}

#[derive(Debug, Clone, PartialEq)]
pub enum LeafValue {
    /// Any JSON value (scalars, arrays, objects).
    Data(Value),
    /// The interior of an `elemMatch` leaf.
    Condition(Box<Condition>),
}

pub const TYPE_FILTERS: &str = "filters";
pub const TYPE_FILTER: &str = "filter";
pub const TYPE_CUSTOM: &str = "custom";

impl Condition {
    pub fn compound(operator: &str, children: Vec<Condition>) -> Self {
        Condition::Compound {
            operator: operator.to_string(),
            children,
        }
    }

    pub fn leaf(operator: &str, field: impl Into<String>, value: Value) -> Self {
        Condition::Leaf {
            operator: operator.to_string(),
            field: field.into(),
            value: LeafValue::Data(value),
        }
    }

    pub fn elem_match(field: impl Into<String>, condition: Condition) -> Self {
        Condition::Leaf {
            operator: "elemMatch".to_string(),
            field: field.into(),
            value: LeafValue::Condition(Box::new(condition)),
        }
    }

    pub fn operator(&self) -> &str {
        match self {
            Condition::Compound { operator, .. } | Condition::Leaf { operator, .. } => operator,
            Condition::Custom { operator } => operator.as_deref().unwrap_or(""),
        }
    }

    // -----------------------------------------------------------

    pub fn from_json_str(input: &str) -> Result<Self> {
        let value: Value = serde_json::from_str(input).map_err(|_| Error::input_invalid())?;

        Self::from_json(&value)
    }

    /// Decode a node. A value that is not a node (no `type`
    /// discriminant) is detached transport data, refused with the same
    /// `conditionDetached` diagnostic the TypeScript lowering raises.
    pub fn from_json(input: &Value) -> Result<Self> {
        let Value::Object(object) = input else {
            return Err(Error::condition_detached(None));
        };

        let operator = object.get("operator").and_then(Value::as_str);

        match object.get("type").and_then(Value::as_str) {
            Some(TYPE_FILTERS) => {
                let operator = operator.ok_or_else(Error::input_invalid)?;
                let children = match object.get("value") {
                    Some(Value::Array(items)) => items
                        .iter()
                        .map(Self::from_json)
                        .collect::<Result<Vec<_>>>()?,
                    None | Some(Value::Null) => Vec::new(),
                    Some(_) => return Err(Error::input_invalid()),
                };

                Ok(Self::compound(operator, children))
            }
            Some(TYPE_FILTER) => {
                let operator = operator.ok_or_else(Error::input_invalid)?;
                let field = object
                    .get("field")
                    .and_then(Value::as_str)
                    .ok_or_else(Error::input_invalid)?;
                let raw = object.get("value").cloned().unwrap_or(Value::Null);

                let value = if operator == "elemMatch" && is_node(&raw) {
                    LeafValue::Condition(Box::new(Self::from_json(&raw)?))
                } else {
                    LeafValue::Data(raw)
                };

                Ok(Condition::Leaf {
                    operator: operator.to_string(),
                    field: field.to_string(),
                    value,
                })
            }
            Some(TYPE_CUSTOM) => Ok(Condition::Custom {
                operator: operator.map(str::to_string),
            }),
            _ => Err(Error::condition_detached(operator)),
        }
    }

    pub fn to_json(&self) -> Value {
        let mut object = Map::new();

        match self {
            Condition::Compound { operator, children } => {
                object.insert("type".into(), Value::from(TYPE_FILTERS));
                object.insert("operator".into(), Value::from(operator.as_str()));
                object.insert(
                    "value".into(),
                    Value::Array(children.iter().map(Self::to_json).collect()),
                );
            }
            Condition::Leaf {
                operator,
                field,
                value,
            } => {
                object.insert("type".into(), Value::from(TYPE_FILTER));
                object.insert("operator".into(), Value::from(operator.as_str()));
                object.insert("field".into(), Value::from(field.as_str()));
                object.insert(
                    "value".into(),
                    match value {
                        LeafValue::Data(data) => data.clone(),
                        LeafValue::Condition(condition) => condition.to_json(),
                    },
                );
            }
            Condition::Custom { operator } => {
                object.insert("type".into(), Value::from(TYPE_CUSTOM));
                if let Some(operator) = operator {
                    object.insert("operator".into(), Value::from(operator.as_str()));
                }
            }
        }

        Value::Object(object)
    }

    /// Serialize straight from the tree (no intermediate `Value`).
    pub fn to_json_string(&self) -> String {
        serde_json::to_string(self).expect("the IR always serializes")
    }
}

impl Serialize for Condition {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        match self {
            Condition::Compound { operator, children } => {
                let mut map = serializer.serialize_map(Some(3))?;
                map.serialize_entry("type", TYPE_FILTERS)?;
                map.serialize_entry("operator", operator)?;
                map.serialize_entry("value", children)?;
                map.end()
            }
            Condition::Leaf {
                operator,
                field,
                value,
            } => {
                let mut map = serializer.serialize_map(Some(4))?;
                map.serialize_entry("type", TYPE_FILTER)?;
                map.serialize_entry("operator", operator)?;
                map.serialize_entry("field", field)?;
                match value {
                    LeafValue::Data(data) => map.serialize_entry("value", data)?,
                    LeafValue::Condition(condition) => map.serialize_entry("value", condition)?,
                }
                map.end()
            }
            Condition::Custom { operator } => {
                let mut map = serializer.serialize_map(None)?;
                map.serialize_entry("type", TYPE_CUSTOM)?;
                if let Some(operator) = operator {
                    map.serialize_entry("operator", operator)?;
                }
                map.end()
            }
        }
    }
}

fn is_node(value: &Value) -> bool {
    matches!(
        value.get("type").and_then(Value::as_str),
        Some(TYPE_FILTERS | TYPE_FILTER | TYPE_CUSTOM)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn string_and_value_serializations_agree() {
        let condition = Condition::compound(
            "and",
            vec![
                Condition::leaf("eq", "name", json!("x")),
                Condition::elem_match("items", Condition::leaf("in", "kind", json!(["a", null]))),
            ],
        );

        let text: Value = serde_json::from_str(&condition.to_json_string()).unwrap();
        assert_eq!(text, condition.to_json());
    }
}

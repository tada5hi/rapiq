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
        }

        Value::Object(object)
    }

    pub fn to_json_string(&self) -> String {
        self.to_json().to_string()
    }
}

fn is_node(value: &Value) -> bool {
    matches!(
        value.get("type").and_then(Value::as_str),
        Some(TYPE_FILTERS | TYPE_FILTER)
    )
}

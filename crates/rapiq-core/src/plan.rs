//! Port of `@rapiq/core`'s `planCondition` lowering: every semantic
//! policy decision (negation twins, null equality, in/nin
//! decomposition, the case-fold verdict, value validation, ITSELF
//! placement) is made here, so the evaluator only compiles primitives.

use std::collections::HashSet;

use serde_json::Value;

use crate::error::{Error, Result};
use crate::expression::ITSELF;
use crate::ir::{Condition, LeafValue};
use crate::value::js_to_string;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum CaseSensitive {
    /// The case-insensitive default for every field.
    #[default]
    None,
    /// Every comparison stays case-sensitive.
    All,
    /// The listed field keys (full paths composed through elemMatch
    /// scopes) stay case-sensitive.
    Fields(HashSet<String>),
}

#[derive(Debug, Clone, Default)]
pub struct PlanOptions {
    pub case_sensitive: CaseSensitive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompareOp {
    Eq,
    Lt,
    Lte,
    Gt,
    Gte,
}

impl CompareOp {
    /// Accepted three-way comparison range of the ordering operators.
    pub fn range(self) -> (i8, i8) {
        match self {
            CompareOp::Eq => (0, 0),
            CompareOp::Lt => (-1, -1),
            CompareOp::Lte => (-1, 0),
            CompareOp::Gt => (1, 1),
            CompareOp::Gte => (0, 1),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum MatchPattern {
    Starts(String),
    Ends(String),
    Contains(String),
    Regex { source: String, flags: String },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Plan {
    Compound {
        or: bool,
        negated: bool,
        children: Vec<Plan>,
    },
    Constant(bool),
    NullCheck {
        field: String,
        negated: bool,
        elementwise: bool,
    },
    Compare {
        field: String,
        op: CompareOp,
        value: Value,
        case_fold: bool,
        negated: bool,
    },
    OneOf {
        field: String,
        values: Vec<Value>,
        includes_null: bool,
        case_fold: bool,
        negated: bool,
    },
    Match {
        field: String,
        pattern: MatchPattern,
        ignore_case: bool,
        negated: bool,
    },
    Mod {
        field: String,
        divisor: f64,
        remainder: f64,
    },
    Size {
        field: String,
        count: Option<usize>,
    },
    ElemMatch {
        field: String,
        condition: Box<Plan>,
    },
}

/// Lower a condition tree. `None` when the tree is empty (an empty
/// compound vanishes).
pub fn plan_condition(input: &Condition, options: &PlanOptions) -> Result<Option<Plan>> {
    Lowering {
        options,
        field_prefix: String::new(),
        element_depth: 0,
    }
    .lower(input)
}

struct Lowering<'a> {
    options: &'a PlanOptions,
    field_prefix: String,
    element_depth: usize,
}

#[derive(Clone, Copy)]
enum Family {
    Equality,
    Ordering(CompareOp),
    Membership,
    Anchored(Anchor),
    Regex,
    Existence,
    Arithmetic,
    Cardinality,
    Structural,
}

#[derive(Clone, Copy)]
enum Anchor {
    Start,
    End,
    Contains,
}

/// The operator-semantics table: family, and whether the operator is
/// the null-inclusive complement of a positive twin.
fn semantics(operator: &str) -> Option<(Family, bool)> {
    Some(match operator {
        "eq" => (Family::Equality, false),
        "ne" => (Family::Equality, true),
        "lt" => (Family::Ordering(CompareOp::Lt), false),
        "lte" => (Family::Ordering(CompareOp::Lte), false),
        "gt" => (Family::Ordering(CompareOp::Gt), false),
        "gte" => (Family::Ordering(CompareOp::Gte), false),
        "in" => (Family::Membership, false),
        "nin" => (Family::Membership, true),
        "startsWith" => (Family::Anchored(Anchor::Start), false),
        "notStartsWith" => (Family::Anchored(Anchor::Start), true),
        "endsWith" => (Family::Anchored(Anchor::End), false),
        "notEndsWith" => (Family::Anchored(Anchor::End), true),
        "contains" => (Family::Anchored(Anchor::Contains), false),
        "notContains" => (Family::Anchored(Anchor::Contains), true),
        "regex" => (Family::Regex, false),
        "mod" => (Family::Arithmetic, false),
        "size" => (Family::Cardinality, false),
        "exists" => (Family::Existence, false),
        "elemMatch" => (Family::Structural, false),
        _ => return None,
    })
}

impl Lowering<'_> {
    fn lower(&mut self, input: &Condition) -> Result<Option<Plan>> {
        match input {
            Condition::Compound { operator, children } => self.lower_compound(operator, children),
            Condition::Leaf {
                operator,
                field,
                value,
            } => self.lower_leaf(operator, field, value),
        }
    }

    fn lower_compound(&mut self, operator: &str, input: &[Condition]) -> Result<Option<Plan>> {
        // group negation is the exact complement of the group verdict.
        let (or, negated) = match operator {
            "and" => (false, false),
            "or" => (true, false),
            "nor" => (true, true),
            "not" => (false, true),
            other => return Err(Error::operator_unsupported(other)),
        };

        let mut children = Vec::with_capacity(input.len());
        for child in input {
            if let Some(plan) = self.lower(child)? {
                children.push(plan);
            }
        }

        if children.is_empty() {
            return Ok(None);
        }

        // a single-child negation normalizes onto the child's own
        // negated form where one exists (not(eq) = ne).
        if negated && children.len() == 1 {
            return Ok(Some(negate_plan(children.remove(0))));
        }

        Ok(Some(Plan::Compound {
            or,
            negated,
            children,
        }))
    }

    fn lower_leaf(
        &mut self,
        operator: &str,
        field: &str,
        value: &LeafValue,
    ) -> Result<Option<Plan>> {
        let Some((family, negated)) = semantics(operator) else {
            return Err(Error::operator_unsupported(operator));
        };

        if field == ITSELF && self.element_depth == 0 {
            return Err(Error::feature_unsupported("filters:itself"));
        }

        if let Family::Structural = family {
            return self.lower_elem_match(field, value);
        }

        let value = match value {
            LeafValue::Data(data) => data,
            // only elemMatch carries a condition interior.
            LeafValue::Condition(_) => return Err(Error::feature_unsupported("filters:value")),
        };
        let field = field.to_string();

        Ok(Some(match family {
            Family::Equality => {
                if value.is_null() {
                    Plan::NullCheck {
                        field,
                        negated,
                        elementwise: true,
                    }
                } else {
                    let case_fold = value.is_string() && self.is_foldable_field(&field);
                    Plan::Compare {
                        field,
                        op: CompareOp::Eq,
                        value: value.clone(),
                        case_fold,
                        negated,
                    }
                }
            }
            Family::Ordering(op) => Plan::Compare {
                field,
                op,
                value: value.clone(),
                case_fold: false,
                negated: false,
            },
            Family::Membership => self.lower_membership(field, value, negated),
            Family::Anchored(anchor) => {
                let text = js_to_string(value);
                let pattern = match anchor {
                    Anchor::Start => MatchPattern::Starts(text),
                    Anchor::End => MatchPattern::Ends(text),
                    Anchor::Contains => MatchPattern::Contains(text),
                };
                let ignore_case = self.is_foldable_field(&field);

                Plan::Match {
                    field,
                    pattern,
                    ignore_case,
                    negated,
                }
            }
            Family::Regex => match value {
                // a string pattern passes through unvalidated: the
                // consuming engine interprets it.
                Value::String(source) => Plan::Match {
                    field,
                    pattern: MatchPattern::Regex {
                        source: source.clone(),
                        flags: String::new(),
                    },
                    ignore_case: false,
                    negated: false,
                },
                _ => return Err(Error::feature_unsupported("filters:regex:value")),
            },
            Family::Existence => Plan::NullCheck {
                field,
                negated: is_truthy(value),
                elementwise: false,
            },
            Family::Arithmetic => lower_mod(field, value),
            Family::Cardinality => {
                let count = value
                    .as_f64()
                    .filter(|n| *n >= 0.0 && n.fract() == 0.0 && *n <= 9_007_199_254_740_991.0)
                    .map(|n| n as usize);

                Plan::Size { field, count }
            }
            Family::Structural => unreachable!("handled above"),
        }))
    }

    fn lower_membership(&self, field: String, value: &Value, negated: bool) -> Plan {
        let items = match value {
            Value::Array(items) if !items.is_empty() => items,
            _ => return Plan::Constant(negated),
        };

        let values: Vec<Value> = items.iter().filter(|v| !v.is_null()).cloned().collect();
        if values.is_empty() {
            return Plan::NullCheck {
                field,
                negated,
                elementwise: true,
            };
        }

        let includes_null = values.len() != items.len();
        let case_fold = self.is_foldable_field(&field);

        Plan::OneOf {
            field,
            values,
            includes_null,
            case_fold,
            negated,
        }
    }

    fn lower_elem_match(&mut self, field: &str, value: &LeafValue) -> Result<Option<Plan>> {
        let interior = match value {
            LeafValue::Condition(condition) => condition,
            LeafValue::Data(data) => {
                // a condition-shaped interior is detached transport data.
                if let Some(operator) = data.get("operator").and_then(Value::as_str) {
                    return Err(Error::condition_detached(Some(operator)));
                }

                return Err(Error::feature_unsupported("filters:elemMatch:value"));
            }
        };

        let prefix = format!("{}{field}.", self.field_prefix);
        let old_prefix = std::mem::replace(&mut self.field_prefix, prefix);
        self.element_depth += 1;

        let condition = self.lower(interior);

        self.field_prefix = old_prefix;
        self.element_depth -= 1;

        Ok(condition?.map(|condition| Plan::ElemMatch {
            field: field.to_string(),
            condition: Box::new(condition),
        }))
    }

    fn is_foldable_field(&self, field: &str) -> bool {
        match &self.options.case_sensitive {
            CaseSensitive::None => true,
            CaseSensitive::All => false,
            CaseSensitive::Fields(fields) => {
                !fields.contains(&format!("{}{field}", self.field_prefix))
            }
        }
    }
}

/// The exact complement of a plan node.
fn negate_plan(plan: Plan) -> Plan {
    match plan {
        Plan::Constant(verdict) => Plan::Constant(!verdict),
        Plan::NullCheck {
            field,
            negated,
            elementwise,
        } => Plan::NullCheck {
            field,
            negated: !negated,
            elementwise,
        },
        Plan::OneOf {
            field,
            values,
            includes_null,
            case_fold,
            negated,
        } => Plan::OneOf {
            field,
            values,
            includes_null,
            case_fold,
            negated: !negated,
        },
        Plan::Match {
            field,
            pattern,
            ignore_case,
            negated,
        } => Plan::Match {
            field,
            pattern,
            ignore_case,
            negated: !negated,
        },
        Plan::Compare {
            field,
            op: CompareOp::Eq,
            value,
            case_fold,
            negated,
        } => Plan::Compare {
            field,
            op: CompareOp::Eq,
            value,
            case_fold,
            negated: !negated,
        },
        Plan::Compound {
            or,
            negated,
            children,
        } => Plan::Compound {
            or,
            negated: !negated,
            children,
        },
        other => Plan::Compound {
            or: false,
            negated: true,
            children: vec![other],
        },
    }
}

fn lower_mod(field: String, value: &Value) -> Plan {
    let pair = value
        .as_array()
        .filter(|items| items.len() == 2)
        .and_then(|items| Some((items[0].as_f64()?, items[1].as_f64()?)));

    match pair {
        Some((divisor, remainder)) if divisor != 0.0 => Plan::Mod {
            field,
            divisor,
            remainder,
        },
        // a malformed pair matches nothing (mongo parity).
        _ => Plan::Constant(false),
    }
}

/// JavaScript truthiness of a JSON value (`!!value`).
fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|n| n != 0.0),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

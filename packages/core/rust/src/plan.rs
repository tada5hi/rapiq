//! Port of `@rapiq/core`'s `planCondition` lowering and `distributeNegation`
//! (`parameter/filters/plan/`): every semantic policy decision (negation
//! twins, null equality, in/nin decomposition, the case-fold verdict, value
//! validation, ITSELF placement) is made here, so consumers only render or
//! compile primitives.
//!
//! A [`Plan`] serializes to exactly the TypeScript `ConditionPlan` shape
//! ([`Plan::to_json`], [`Plan::from_json`]), so the TypeScript adapters keep
//! interpreting the same objects. Values pass through untouched, including
//! host value references (see [`crate::value::HOST_REF_KEY`]).

use std::collections::HashSet;

use serde_json::{Map, Value, json};

use crate::error::{Error, Result};
use crate::expression::ITSELF;
use crate::ir::{Condition, LeafValue};
use crate::number::json_number;
use crate::value::{condition_operator, js_number, js_regexp, js_to_string, js_truthy};

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

// -----------------------------------------------------------
// the operator-semantics table
// -----------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Family {
    Equality,
    Ordering,
    Membership,
    Anchored,
    Regex,
    Existence,
    Arithmetic,
    Cardinality,
    Structural,
}

impl Family {
    pub fn as_str(self) -> &'static str {
        match self {
            Family::Equality => "equality",
            Family::Ordering => "ordering",
            Family::Membership => "membership",
            Family::Anchored => "anchored",
            Family::Regex => "regex",
            Family::Existence => "existence",
            Family::Arithmetic => "arithmetic",
            Family::Cardinality => "cardinality",
            Family::Structural => "structural",
        }
    }
}

/// One row of the operator-semantics table (`FILTER_OPERATOR_SEMANTICS`):
/// the single source of truth for what an operator means.
#[derive(Debug, Clone, Copy)]
pub struct OperatorSemantics {
    pub operator: &'static str,
    pub family: Family,
    /// Negation twin: this operator is the null-inclusive complement of
    /// the named positive operator.
    pub complement_of: Option<&'static str>,
    /// Anchored family only: (start, end) anchor placement.
    pub anchor: Option<(bool, bool)>,
    /// Ordering family only: accepted three-way comparison range.
    pub compare: Option<(i8, i8)>,
    /// Participation in the case-insensitive default for strings.
    pub foldable: bool,
}

const fn row(
    operator: &'static str,
    family: Family,
    complement_of: Option<&'static str>,
    anchor: Option<(bool, bool)>,
    compare: Option<(i8, i8)>,
    foldable: bool,
) -> OperatorSemantics {
    OperatorSemantics {
        operator,
        family,
        complement_of,
        anchor,
        compare,
        foldable,
    }
}

/// The table, in the TypeScript declaration order.
pub const OPERATOR_SEMANTICS: &[OperatorSemantics] = &[
    row("eq", Family::Equality, None, None, None, true),
    row("ne", Family::Equality, Some("eq"), None, None, true),
    row("lt", Family::Ordering, None, None, Some((-1, -1)), false),
    row("lte", Family::Ordering, None, None, Some((-1, 0)), false),
    row("gt", Family::Ordering, None, None, Some((1, 1)), false),
    row("gte", Family::Ordering, None, None, Some((0, 1)), false),
    row("in", Family::Membership, None, None, None, true),
    row("nin", Family::Membership, Some("in"), None, None, true),
    row(
        "startsWith",
        Family::Anchored,
        None,
        Some((true, false)),
        None,
        true,
    ),
    row(
        "notStartsWith",
        Family::Anchored,
        Some("startsWith"),
        Some((true, false)),
        None,
        true,
    ),
    row(
        "endsWith",
        Family::Anchored,
        None,
        Some((false, true)),
        None,
        true,
    ),
    row(
        "notEndsWith",
        Family::Anchored,
        Some("endsWith"),
        Some((false, true)),
        None,
        true,
    ),
    row(
        "contains",
        Family::Anchored,
        None,
        Some((false, false)),
        None,
        true,
    ),
    row(
        "notContains",
        Family::Anchored,
        Some("contains"),
        Some((false, false)),
        None,
        true,
    ),
    row("regex", Family::Regex, None, None, None, false),
    row("mod", Family::Arithmetic, None, None, None, false),
    row("size", Family::Cardinality, None, None, None, false),
    row("exists", Family::Existence, None, None, None, false),
    row("elemMatch", Family::Structural, None, None, None, false),
];

pub fn semantics(operator: &str) -> Option<&'static OperatorSemantics> {
    OPERATOR_SEMANTICS
        .iter()
        .find(|row| row.operator == operator)
}

/// The table as JSON, in the exact shape of the TypeScript constant
/// `FILTER_OPERATOR_SEMANTICS` (keys only where the row sets them).
pub fn operator_semantics_json() -> Value {
    let mut table = Map::new();
    for row in OPERATOR_SEMANTICS {
        let mut entry = Map::new();
        entry.insert("family".into(), Value::from(row.family.as_str()));
        if let Some(twin) = row.complement_of {
            entry.insert("complementOf".into(), Value::from(twin));
        }
        if let Some((start, end)) = row.anchor {
            entry.insert("anchor".into(), json!({ "start": start, "end": end }));
        }
        if let Some((min, max)) = row.compare {
            entry.insert("compare".into(), json!({ "min": min, "max": max }));
        }
        entry.insert("foldable".into(), Value::from(row.foldable));
        table.insert(row.operator.into(), Value::Object(entry));
    }

    Value::Object(table)
}

// -----------------------------------------------------------
// plan nodes
// -----------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompareOp {
    Eq,
    Lt,
    Lte,
    Gt,
    Gte,
}

impl CompareOp {
    pub fn as_str(self) -> &'static str {
        match self {
            CompareOp::Eq => "eq",
            CompareOp::Lt => "lt",
            CompareOp::Lte => "lte",
            CompareOp::Gt => "gt",
            CompareOp::Gte => "gte",
        }
    }

    fn parse(input: &str) -> Option<Self> {
        Some(match input {
            "eq" => CompareOp::Eq,
            "lt" => CompareOp::Lt,
            "lte" => CompareOp::Lte,
            "gt" => CompareOp::Gt,
            "gte" => CompareOp::Gte,
            _ => return None,
        })
    }

    /// Accepted three-way comparison range (from the semantics table).
    pub fn range(self) -> (i8, i8) {
        match self {
            CompareOp::Eq => (0, 0),
            other => semantics(other.as_str())
                .and_then(|row| row.compare)
                .expect("ordering operators carry a range"),
        }
    }

    /// The ordering operator accepting exactly the complementary range
    /// (lt {-1..-1} complements gte {0..1}), derived from the table.
    fn complement(self) -> Option<Self> {
        if self == CompareOp::Eq {
            return None;
        }

        let (min, max) = self.range();
        let wanted = (
            if max == 1 { -1 } else { max + 1 },
            if min == -1 { 1 } else { min - 1 },
        );

        [CompareOp::Lt, CompareOp::Lte, CompareOp::Gt, CompareOp::Gte]
            .into_iter()
            .find(|candidate| candidate.range() == wanted)
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
        /// A usable POSITIVE JavaScript pattern (metacharacters escaped,
        /// anchors applied), as `createFilterRegexPattern` produces it.
        regex_source: String,
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

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

impl Plan {
    /// The TypeScript `ConditionPlan` JSON shape.
    pub fn to_json(&self) -> Value {
        match self {
            Plan::Compound {
                or,
                negated,
                children,
            } => json!({
                "kind": "compound",
                "operator": if *or { "or" } else { "and" },
                "negated": negated,
                "children": children.iter().map(Plan::to_json).collect::<Vec<_>>(),
            }),
            Plan::Constant(verdict) => json!({ "kind": "constant", "verdict": verdict }),
            Plan::NullCheck {
                field,
                negated,
                elementwise,
            } => json!({
                "kind": "null-check",
                "field": field,
                "negated": negated,
                "elementwise": elementwise,
            }),
            Plan::Compare {
                field,
                op,
                value,
                case_fold,
                negated,
            } => json!({
                "kind": "compare",
                "field": field,
                "op": op.as_str(),
                "value": value,
                "caseFold": case_fold,
                "negated": negated,
            }),
            Plan::OneOf {
                field,
                values,
                includes_null,
                case_fold,
                negated,
            } => json!({
                "kind": "one-of",
                "field": field,
                "values": values,
                "includesNull": includes_null,
                "caseFold": case_fold,
                "negated": negated,
            }),
            Plan::Match {
                field,
                pattern,
                regex_source,
                ignore_case,
                negated,
            } => {
                let pattern = match pattern {
                    MatchPattern::Starts(text) => json!({ "mode": "starts", "text": text }),
                    MatchPattern::Ends(text) => json!({ "mode": "ends", "text": text }),
                    MatchPattern::Contains(text) => json!({ "mode": "contains", "text": text }),
                    MatchPattern::Regex { source, flags } => {
                        json!({ "mode": "regex", "source": source, "flags": flags })
                    }
                };

                json!({
                    "kind": "match",
                    "field": field,
                    "pattern": pattern,
                    "regexSource": regex_source,
                    "ignoreCase": ignore_case,
                    "negated": negated,
                })
            }
            Plan::Mod {
                field,
                divisor,
                remainder,
            } => json!({
                "kind": "mod",
                "field": field,
                "divisor": json_number(*divisor).unwrap_or(Value::Null),
                "remainder": json_number(*remainder).unwrap_or(Value::Null),
            }),
            Plan::Size { field, count } => json!({
                "kind": "size",
                "field": field,
                "count": count,
            }),
            Plan::ElemMatch { field, condition } => json!({
                "kind": "elem-match",
                "field": field,
                "condition": condition.to_json(),
            }),
        }
    }

    /// Decode the TypeScript `ConditionPlan` JSON shape.
    pub fn from_json(input: &Value) -> Result<Self> {
        let invalid = Error::input_invalid;
        let object = input.as_object().ok_or_else(invalid)?;
        let kind = object
            .get("kind")
            .and_then(Value::as_str)
            .ok_or_else(invalid)?;

        let string = |key: &str| -> Result<String> {
            object
                .get(key)
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(invalid)
        };
        let boolean = |key: &str| -> Result<bool> {
            object.get(key).and_then(Value::as_bool).ok_or_else(invalid)
        };
        let number = |key: &str| -> Result<f64> {
            object.get(key).and_then(Value::as_f64).ok_or_else(invalid)
        };

        Ok(match kind {
            "compound" => Plan::Compound {
                or: string("operator")? == "or",
                negated: boolean("negated")?,
                children: object
                    .get("children")
                    .and_then(Value::as_array)
                    .ok_or_else(invalid)?
                    .iter()
                    .map(Plan::from_json)
                    .collect::<Result<Vec<_>>>()?,
            },
            "constant" => Plan::Constant(boolean("verdict")?),
            "null-check" => Plan::NullCheck {
                field: string("field")?,
                negated: boolean("negated")?,
                elementwise: boolean("elementwise")?,
            },
            "compare" => Plan::Compare {
                field: string("field")?,
                op: CompareOp::parse(&string("op")?).ok_or_else(invalid)?,
                value: object.get("value").cloned().unwrap_or(Value::Null),
                case_fold: boolean("caseFold")?,
                negated: boolean("negated")?,
            },
            "one-of" => Plan::OneOf {
                field: string("field")?,
                values: object
                    .get("values")
                    .and_then(Value::as_array)
                    .cloned()
                    .ok_or_else(invalid)?,
                includes_null: boolean("includesNull")?,
                case_fold: boolean("caseFold")?,
                negated: boolean("negated")?,
            },
            "match" => {
                let pattern = object
                    .get("pattern")
                    .and_then(Value::as_object)
                    .ok_or_else(invalid)?;
                let text = || -> Result<String> {
                    pattern
                        .get("text")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .ok_or_else(invalid)
                };
                let pattern = match pattern.get("mode").and_then(Value::as_str) {
                    Some("starts") => MatchPattern::Starts(text()?),
                    Some("ends") => MatchPattern::Ends(text()?),
                    Some("contains") => MatchPattern::Contains(text()?),
                    Some("regex") => MatchPattern::Regex {
                        source: pattern
                            .get("source")
                            .and_then(Value::as_str)
                            .ok_or_else(invalid)?
                            .to_string(),
                        flags: pattern
                            .get("flags")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                    },
                    _ => return Err(invalid()),
                };

                Plan::Match {
                    field: string("field")?,
                    pattern,
                    regex_source: string("regexSource")?,
                    ignore_case: boolean("ignoreCase")?,
                    negated: boolean("negated")?,
                }
            }
            "mod" => Plan::Mod {
                field: string("field")?,
                divisor: number("divisor")?,
                remainder: number("remainder")?,
            },
            "size" => Plan::Size {
                field: string("field")?,
                count: object
                    .get("count")
                    .and_then(Value::as_u64)
                    .map(|n| n as usize),
            },
            "elem-match" => Plan::ElemMatch {
                field: string("field")?,
                condition: Box::new(Plan::from_json(
                    object.get("condition").ok_or_else(invalid)?,
                )?),
            },
            other => return Err(Error::feature_unsupported(&format!("filters:{other}"))),
        })
    }
}

// -----------------------------------------------------------
// planCondition
// -----------------------------------------------------------

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

impl Lowering<'_> {
    fn lower(&mut self, input: &Condition) -> Result<Option<Plan>> {
        match input {
            Condition::Compound { operator, children } => self.lower_compound(operator, children),
            Condition::Leaf {
                operator,
                field,
                value,
            } => self.lower_leaf(operator, field, value),
            Condition::Custom { operator } => Err(Error::condition_detached(operator.as_deref())),
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

        // a single-child negation normalizes onto the child's own negated
        // form where one exists (not(eq) = ne).
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
        let Some(row) = semantics(operator) else {
            return Err(Error::operator_unsupported(operator));
        };

        // the ITSELF marker addresses the element bound by an enclosing
        // elemMatch scope; outside one it has no referent.
        if field == ITSELF && self.element_depth == 0 {
            return Err(Error::feature_unsupported("filters:itself"));
        }

        if row.family == Family::Structural {
            return self.lower_elem_match(field, value);
        }

        let value = match value {
            LeafValue::Data(data) => data,
            LeafValue::Condition(_) => return Err(Error::feature_unsupported("filters:value")),
        };
        let negated = row.complement_of.is_some();
        let field = field.to_string();

        Ok(Some(match row.family {
            Family::Equality => {
                if value.is_null() {
                    Plan::NullCheck {
                        field,
                        negated,
                        elementwise: true,
                    }
                } else {
                    let case_fold =
                        row.foldable && value.is_string() && self.is_foldable_field(&field);
                    Plan::Compare {
                        field,
                        op: CompareOp::Eq,
                        value: value.clone(),
                        case_fold,
                        negated,
                    }
                }
            }
            Family::Ordering => Plan::Compare {
                field,
                op: CompareOp::parse(operator).expect("ordering operator"),
                value: value.clone(),
                case_fold: false,
                negated: false,
            },
            Family::Membership => self.lower_membership(field, value, negated, row.foldable),
            Family::Anchored => {
                let (start, end) = row.anchor.unwrap_or((false, false));
                let text = js_to_string(value);
                let escaped = escape_js_regex(&text);

                let (pattern, regex_source) = if start {
                    (MatchPattern::Starts(text), format!("^{escaped}"))
                } else if end {
                    (MatchPattern::Ends(text), format!("{escaped}$"))
                } else {
                    (MatchPattern::Contains(text), escaped)
                };

                Plan::Match {
                    ignore_case: row.foldable && self.is_foldable_field(&field),
                    field,
                    pattern,
                    regex_source,
                    negated,
                }
            }
            Family::Regex => lower_regex(field, value)?,
            Family::Existence => Plan::NullCheck {
                field,
                negated: js_truthy(value),
                elementwise: false,
            },
            Family::Arithmetic => lower_mod(field, value),
            Family::Cardinality => Plan::Size {
                field,
                count: js_number(value)
                    .filter(|n| *n >= 0.0 && n.fract() == 0.0 && *n <= MAX_SAFE_INTEGER)
                    .map(|n| n as usize),
            },
            Family::Structural => unreachable!("handled above"),
        }))
    }

    fn lower_membership(
        &self,
        field: String,
        value: &Value,
        negated: bool,
        foldable: bool,
    ) -> Plan {
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
        let case_fold = foldable && self.is_foldable_field(&field);

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
                // a condition-shaped interior is detached transport data
                // (or a live custom condition); anything else is an
                // unsupported interior value.
                if let Some(operator) = condition_operator(data) {
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

/// `createFilterRegexPattern`'s escaping: the literal filter value becomes
/// a JavaScript pattern matching it verbatim.
fn escape_js_regex(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    for c in input.chars() {
        if matches!(
            c,
            '.' | '*' | '+' | '?' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\'
        ) {
            output.push('\\');
        }
        output.push(c);
    }

    output
}

fn lower_regex(field: String, value: &Value) -> Result<Plan> {
    if let Some((source, flags)) = js_regexp(value) {
        // strip the stateful flags, so repeated tests never depend on
        // lastIndex.
        let flags: String = flags.chars().filter(|c| !matches!(c, 'g' | 'y')).collect();

        return Ok(Plan::Match {
            field,
            ignore_case: flags.contains('i'),
            regex_source: source.to_string(),
            pattern: MatchPattern::Regex {
                source: source.to_string(),
                flags,
            },
            negated: false,
        });
    }

    // a string pattern passes through unvalidated: the consuming engine
    // interprets it.
    if let Value::String(source) = value {
        return Ok(Plan::Match {
            field,
            pattern: MatchPattern::Regex {
                source: source.clone(),
                flags: String::new(),
            },
            regex_source: source.clone(),
            ignore_case: false,
            negated: false,
        });
    }

    Err(Error::feature_unsupported("filters:regex:value"))
}

fn lower_mod(field: String, value: &Value) -> Plan {
    let pair = value
        .as_array()
        .filter(|items| items.len() == 2)
        .and_then(|items| Some((js_number(&items[0])?, js_number(&items[1])?)));

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

/// The exact complement of a plan node: leaf kinds with a negated form
/// flip it, constants flip their verdict, compounds flip their group
/// negation; the rest wrap in a negated single-child compound.
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
            regex_source,
            ignore_case,
            negated,
        } => Plan::Match {
            field,
            pattern,
            regex_source,
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

// -----------------------------------------------------------
// distributeNegation
// -----------------------------------------------------------

/// Push group negation down to the leaves, eliminating
/// `Compound.negated` (for consumers without a two-valued NOT, such as
/// the prisma and drizzle serializers). Semantics-preserving under the
/// settled negation contract: De Morgan per binding, negation commutes
/// through `elemMatch`, leaves flip to their complement twins, an ordering
/// comparison becomes the complementary operator OR a null check, and
/// `mod`/`size` keep a residual negated wrapper.
pub fn distribute_negation(plan: Plan) -> Result<Plan> {
    distribute(plan, false)
}

fn distribute(plan: Plan, negated: bool) -> Result<Plan> {
    Ok(match plan {
        Plan::Compound {
            or,
            negated: own,
            children,
        } => {
            let effective = negated != own;
            let mut children = children
                .into_iter()
                .map(|child| distribute(child, effective))
                .collect::<Result<Vec<_>>>()?;

            // a single-child group carries no operator of its own.
            if children.len() == 1 {
                return Ok(children.remove(0));
            }

            Plan::Compound {
                or: if effective { !or } else { or },
                negated: false,
                children,
            }
        }
        Plan::Constant(verdict) => Plan::Constant(if negated { !verdict } else { verdict }),
        leaf @ (Plan::NullCheck { .. } | Plan::OneOf { .. } | Plan::Match { .. }) => {
            if negated {
                negate_plan(leaf)
            } else {
                leaf
            }
        }
        Plan::Compare {
            field,
            op,
            value,
            case_fold,
            negated: own,
        } => {
            if !negated {
                return Ok(Plan::Compare {
                    field,
                    op,
                    value,
                    case_fold,
                    negated: own,
                });
            }

            if op == CompareOp::Eq {
                return Ok(Plan::Compare {
                    field,
                    op,
                    value,
                    case_fold,
                    negated: !own,
                });
            }

            let complement = op
                .complement()
                .ok_or_else(|| Error::operator_unsupported(op.as_str()))?;

            // the null-inclusive complement of an ordering comparison: the
            // complementary operator, or no value at all.
            Plan::Compound {
                or: true,
                negated: false,
                children: vec![
                    Plan::Compare {
                        field: field.clone(),
                        op: complement,
                        value,
                        case_fold,
                        negated: own,
                    },
                    Plan::NullCheck {
                        field,
                        negated: false,
                        elementwise: true,
                    },
                ],
            }
        }
        Plan::ElemMatch { field, condition } => Plan::ElemMatch {
            field,
            condition: Box::new(distribute(*condition, negated)?),
        },
        residual @ (Plan::Mod { .. } | Plan::Size { .. }) => {
            if negated {
                Plan::Compound {
                    or: false,
                    negated: true,
                    children: vec![residual],
                }
            } else {
                residual
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordering_complements_follow_the_table() {
        assert_eq!(CompareOp::Lt.complement(), Some(CompareOp::Gte));
        assert_eq!(CompareOp::Gte.complement(), Some(CompareOp::Lt));
        assert_eq!(CompareOp::Lte.complement(), Some(CompareOp::Gt));
        assert_eq!(CompareOp::Gt.complement(), Some(CompareOp::Lte));
    }

    #[test]
    fn regex_escaping_matches_create_filter_regex_pattern() {
        assert_eq!(escape_js_regex("a.b*c"), "a\\.b\\*c");
        assert_eq!(
            escape_js_regex("(x)|[y]{2}$^+?\\"),
            "\\(x\\)\\|\\[y\\]\\{2\\}\\$\\^\\+\\?\\\\"
        );
        assert_eq!(escape_js_regex("a-b/c"), "a-b/c");
    }

    #[test]
    fn plans_round_trip_through_json() {
        let plan = Plan::Compound {
            or: true,
            negated: true,
            children: vec![
                Plan::Size {
                    field: "tags".into(),
                    count: None,
                },
                Plan::Match {
                    field: "name".into(),
                    pattern: MatchPattern::Starts("Pe".into()),
                    regex_source: "^Pe".into(),
                    ignore_case: true,
                    negated: false,
                },
            ],
        };

        assert_eq!(Plan::from_json(&plan.to_json()).unwrap(), plan);
    }
}

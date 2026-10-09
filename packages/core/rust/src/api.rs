//! The JSON-string surface shared by every language binding, so the
//! bindings stay one-line wrappers.

use std::collections::HashSet;

use serde_json::Value;

use crate::error::{Error, Result};
use crate::eval::Predicate;
use crate::expression;
use crate::ir::Condition;
use crate::plan::{self, CaseSensitive, Plan, PlanOptions};

/// `ExpressionFiltersParser.parse()` (schemaless) returning the IR as
/// a JSON string.
pub fn parse_expression_filters(input: Option<&str>) -> Result<String> {
    Ok(expression::parse(input)?.to_json_string())
}

/// `ExpressionFiltersParser.parseExact()` (schemaless) returning the
/// IR as a JSON string.
pub fn parse_expression_filters_exact(input: &str) -> Result<String> {
    Ok(expression::parse_exact(input)?.to_json_string())
}

/// Decode `{ "caseSensitive": true | ["field", ...] }`.
pub fn plan_options_from_json(input: Option<&str>) -> Result<PlanOptions> {
    let Some(input) = input else {
        return Ok(PlanOptions::default());
    };

    let value: Value = serde_json::from_str(input).map_err(|_| Error::input_invalid())?;
    let case_sensitive = match value.get("caseSensitive") {
        None | Some(Value::Null) | Some(Value::Bool(false)) => CaseSensitive::None,
        Some(Value::Bool(true)) => CaseSensitive::All,
        Some(Value::Array(items)) => CaseSensitive::Fields(
            items
                .iter()
                .map(|item| {
                    item.as_str()
                        .map(str::to_string)
                        .ok_or_else(Error::input_invalid)
                })
                .collect::<Result<HashSet<_>>>()?,
        ),
        Some(_) => return Err(Error::input_invalid()),
    };

    Ok(PlanOptions { case_sensitive })
}

/// Compile a predicate from an IR JSON string.
pub fn compile(filters: &str, options: Option<&str>) -> Result<Predicate> {
    let condition = Condition::from_json_str(filters)?;
    let options = plan_options_from_json(options)?;

    Predicate::compile(&condition, &options)
}

/// One-shot: does the record (JSON) satisfy the filters (IR JSON)?
pub fn matches(filters: &str, record: &str, options: Option<&str>) -> Result<bool> {
    let predicate = compile(filters, options)?;
    let record: Value = serde_json::from_str(record).map_err(|_| Error::input_invalid())?;

    Ok(predicate.test(&record))
}

/// Positions of the records (a JSON array) satisfying the predicate,
/// so a binding can hand back its own record objects untouched.
pub fn matching_indices(predicate: &Predicate, records: &str) -> Result<Vec<u32>> {
    let records: Value = serde_json::from_str(records).map_err(|_| Error::input_invalid())?;
    let Value::Array(items) = records else {
        return Err(Error::input_invalid());
    };

    Ok(items
        .iter()
        .enumerate()
        .filter(|(_, record)| predicate.test(record))
        .map(|(index, _)| index as u32)
        .collect())
}

/// Test a record JSON string against a compiled predicate.
pub fn test_record(predicate: &Predicate, record: &str) -> Result<bool> {
    let record: Value = serde_json::from_str(record).map_err(|_| Error::input_invalid())?;

    Ok(predicate.test(&record))
}

/// `planCondition`: the plan of a condition tree (IR JSON) as
/// `ConditionPlan` JSON, or `null` for an empty tree.
pub fn plan_condition(condition: &str, options: Option<&str>) -> Result<String> {
    let condition = Condition::from_json_str(condition)?;
    let options = plan_options_from_json(options)?;

    Ok(match plan::plan_condition(&condition, &options)? {
        Some(plan) => plan.to_json().to_string(),
        None => "null".to_string(),
    })
}

/// `distributeNegation`: `ConditionPlan` JSON in, `ConditionPlan` JSON out.
pub fn distribute_negation(plan: &str) -> Result<String> {
    let value: Value = serde_json::from_str(plan).map_err(|_| Error::input_invalid())?;
    let plan = Plan::from_json(&value)?;

    Ok(plan::distribute_negation(plan)?.to_json().to_string())
}

/// `FILTER_OPERATOR_SEMANTICS` as JSON.
pub fn operator_semantics() -> String {
    plan::operator_semantics_json().to_string()
}

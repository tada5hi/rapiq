//! Runs the conformance fixtures against the Rust port. The fixtures live
//! next to the package whose semantics they pin
//! (`packages/<package>/fixtures/`) and are generated from, and re-checked
//! against, the TypeScript reference (`conformance/scripts/generate.ts`).

use std::path::PathBuf;

use rapiq_core::api;
use rapiq_core::plan::{Plan, distribute_negation, plan_condition};
use rapiq_core::value::is_value_equal;
use rapiq_core::{Condition, Predicate, expression};
use serde_json::Value;

/// `package/fixtures/file`, relative to `packages/`.
fn fixture(name: &str) -> Vec<Value> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));

    serde_json::from_str::<Value>(&text)
        .unwrap()
        .as_array()
        .cloned()
        .unwrap()
}

#[test]
fn expression_parser_matches_the_reference() {
    let mut failures = Vec::new();

    for case in fixture("parser-expression/fixtures/expression.json") {
        let input = case["input"].as_str().unwrap();

        match (expression::parse_exact(input), case.get("error")) {
            (Err(error), Some(expected)) => {
                if error.code.as_str() != expected.as_str().unwrap() {
                    failures.push(format!("{input:?}: code {} != {expected}", error.code));
                }
            }
            (Err(error), None) => failures.push(format!("{input:?}: unexpected error {error}")),
            (Ok(output), Some(expected)) => failures.push(format!(
                "{input:?}: expected {expected}, got {}",
                output.to_json()
            )),
            (Ok(exact), None) => {
                if !is_value_equal(&exact.to_json(), &case["exact"]) {
                    failures.push(format!(
                        "{input:?}: exact {} != {}",
                        exact.to_json(),
                        case["exact"]
                    ));
                }

                let parsed = expression::parse(Some(input)).unwrap().to_json();
                if !is_value_equal(&parsed, &case["parse"]) {
                    failures.push(format!("{input:?}: parse {parsed} != {}", case["parse"]));
                }
            }
        }
    }

    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn evaluator_matches_the_reference() {
    let mut failures = Vec::new();

    for group in fixture("adapter-memory/fixtures/evaluate.json") {
        let name = group["name"].as_str().unwrap();
        let options = group.get("options").map(Value::to_string);
        let compiled = Condition::from_json(&group["filters"]).and_then(|condition| {
            let options = api::plan_options_from_json(options.as_deref())?;
            Predicate::compile(&condition, &options)
        });

        match (compiled, group.get("error")) {
            (Err(error), Some(expected)) => {
                if error.code.as_str() != expected.as_str().unwrap() {
                    failures.push(format!("{name}: code {} != {expected}", error.code));
                }
            }
            (Err(error), None) => failures.push(format!("{name}: unexpected error {error}")),
            (Ok(_), Some(expected)) => failures.push(format!("{name}: expected error {expected}")),
            (Ok(predicate), None) => {
                for item in group["cases"].as_array().unwrap() {
                    let expected = item["expected"].as_bool().unwrap();
                    if predicate.test(&item["record"]) != expected {
                        failures.push(format!("{name}: {} expected {expected}", item["record"]));
                    }
                }
            }
        }
    }

    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[test]
fn ir_round_trips() {
    for case in fixture("parser-expression/fixtures/expression.json") {
        if let Some(exact) = case.get("exact") {
            let condition = Condition::from_json(exact).unwrap();
            assert!(is_value_equal(&condition.to_json(), exact));
        }
    }
}

#[test]
fn plan_matches_the_reference() {
    let groups = fixture("core/fixtures/plan.json");
    assert!(groups.len() > 200, "plan fixtures missing");

    let mut failures = Vec::new();

    for group in groups {
        let name = group["name"].as_str().unwrap();
        let options = group.get("options").map(Value::to_string);
        let planned = Condition::from_json(&group["filters"]).and_then(|condition| {
            let options = api::plan_options_from_json(options.as_deref())?;
            plan_condition(&condition, &options)
        });

        match (planned, group.get("error")) {
            (Err(error), Some(expected)) => {
                if error.code.as_str() != expected["code"]
                    || error.message != expected["message"].as_str().unwrap()
                    || error.subject.as_deref() != expected["subject"].as_str()
                {
                    failures.push(format!(
                        "{name}: {:?} {:?} {:?} != {expected}",
                        error.code, error.subject, error.message
                    ));
                }
            }
            (Err(error), None) => failures.push(format!("{name}: unexpected error {error}")),
            (Ok(_), Some(expected)) => failures.push(format!("{name}: expected error {expected}")),
            (Ok(plan), None) => {
                let actual = plan.as_ref().map_or(Value::Null, Plan::to_json);
                if !is_value_equal(&actual, &group["plan"]) {
                    failures.push(format!("{name}: plan {actual} != {}", group["plan"]));
                    continue;
                }

                let distributed = plan
                    .map(|plan| distribute_negation(plan).map(|plan| plan.to_json()))
                    .transpose()
                    .unwrap()
                    .unwrap_or(Value::Null);
                if !is_value_equal(&distributed, &group["distributed"]) {
                    failures.push(format!(
                        "{name}: distributed {distributed} != {}",
                        group["distributed"]
                    ));
                }

                // the JSON shape decodes back to the same plan
                if group["plan"].is_object() {
                    let decoded = Plan::from_json(&group["plan"]).unwrap();
                    if !is_value_equal(&decoded.to_json(), &group["plan"]) {
                        failures.push(format!("{name}: plan JSON does not round-trip"));
                    }
                }
            }
        }
    }

    assert!(
        failures.is_empty(),
        "{} failures:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

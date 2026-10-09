//! Runs the shared conformance fixtures (conformance/fixtures)
//! against the Rust port. The fixtures are generated from, and
//! re-checked against, the TypeScript reference implementation.

use std::path::PathBuf;

use rapiq_core::api;
use rapiq_core::value::is_value_equal;
use rapiq_core::{Condition, Predicate, expression};
use serde_json::Value;

fn fixture(name: &str) -> Vec<Value> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../conformance/fixtures")
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

    for case in fixture("expression.json") {
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

    for group in fixture("evaluate.json") {
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
    for case in fixture("expression.json") {
        if let Some(exact) = case.get("exact") {
            let condition = Condition::from_json(exact).unwrap();
            assert!(is_value_equal(&condition.to_json(), exact));
        }
    }
}

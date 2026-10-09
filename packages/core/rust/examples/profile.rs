//! Times the Rust core without any binding:
//! `cargo run --release -p rapiq-core --example profile`.

// a benchmark reports on stdout by design
#![allow(clippy::print_stdout)]

use std::time::Instant;

use rapiq_core::{PlanOptions, Predicate, expression};
use serde_json::{Value, json};

const EXPRESSION: &str = "and(or(eq(name, 'Peter'), startsWith(email, 'admin@')), gte(age, '18'), \
    elemMatch(items, and(eq(active, 'true'), in(kind, 'book', 'game'))), not(contains(tags, 'spam')))";

fn time<T>(label: &str, iterations: u32, mut f: impl FnMut() -> T) {
    let start = Instant::now();
    for _ in 0..iterations {
        std::hint::black_box(f());
    }
    let per = start.elapsed().as_secs_f64() / f64::from(iterations);
    println!("  {label:<40} {:>12.2} µs/op", per * 1e6);
}

fn main() {
    time("parse", 20_000, || {
        expression::parse(Some(EXPRESSION)).unwrap()
    });
    time("parse + IR JSON string", 20_000, || {
        rapiq_core::api::parse_expression_filters(Some(EXPRESSION)).unwrap()
    });

    let names = ["Peter", "peter", "Hans", "Anna", "admin"];
    let kinds = ["book", "game", "tool"];
    let records: Vec<Value> = (0..100_000usize)
        .map(|i| {
            json!({
                "id": i,
                "name": names[i % names.len()],
                "email": if i % 7 == 0 { format!("admin@{i}.test") } else { format!("user{i}@example.test") },
                "age": i % 60,
                "tags": if i % 11 == 0 { json!(["spam", "x"]) } else { json!(["x", "y"]) },
                "items": (0..(i % 4) + 1).map(|j| json!({
                    "kind": kinds[(i + j) % kinds.len()],
                    "active": (i + j) % 3 == 0,
                })).collect::<Vec<_>>(),
            })
        })
        .collect();
    let text = serde_json::to_string(&records).unwrap();

    let condition = expression::parse(Some(EXPRESSION)).unwrap();
    let predicate = Predicate::compile(&condition, &PlanOptions::default()).unwrap();

    // one decode at a time: the first run also pays for faulting in
    // fresh memory, later runs reuse what the allocator kept.
    let mut kept = Vec::new();
    for run in 0..4 {
        let start = Instant::now();
        let value = serde_json::from_str::<Value>(&text).unwrap();
        println!(
            "  decode 100k records, run {run:<20} {:>12.2} µs/op",
            start.elapsed().as_secs_f64() * 1e6
        );
        kept.push(value);
        if kept.len() > 1 {
            kept.remove(0);
        }
    }
    time("evaluate 100k records", 3, || {
        records.iter().filter(|r| predicate.test(r)).count()
    });
    for probe in [
        "gte(age, '18')",
        "eq(name, 'Peter')",
        "startsWith(email, 'admin@')",
        "contains(tags, 'spam')",
        "elemMatch(items, eq(kind, 'book'))",
        "eq(items.kind, 'book')",
    ] {
        let condition = expression::parse(Some(probe)).unwrap();
        let predicate = Predicate::compile(&condition, &PlanOptions::default()).unwrap();
        time(probe, 3, || {
            records.iter().filter(|r| predicate.test(r)).count()
        });
    }

    println!(
        "  matches: {}",
        records.iter().filter(|r| predicate.test(r)).count()
    );
}

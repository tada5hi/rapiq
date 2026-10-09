# rapiq-core

Rust core of [rapiq](https://github.com/tada5hi/rapiq) (REST API query): the
serialized query IR, the expression filters parser and the in-memory filter
evaluator, shared by the Node.js (napi-rs) and Python (PyO3) bindings.

Status: proof of concept. The API is not stable; see
[crates/MIGRATION.md](https://github.com/tada5hi/rapiq/blob/master/crates/MIGRATION.md)
for the plan.

```rust
use rapiq_core::{expression, PlanOptions, Predicate};
use serde_json::json;

let filters = expression::parse(Some("and(eq(name, 'Peter'), gte(age, '18'))"))?;
let predicate = Predicate::compile(&filters, &PlanOptions::default())?;

assert!(predicate.test(&json!({ "name": "peter", "age": 30 })));
# Ok::<(), rapiq_core::Error>(())
```

License: MIT.

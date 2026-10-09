# rapiq

[rapiq](https://github.com/tada5hi/rapiq) (REST API query) for Rust. This
crate re-exports the rapiq parts; Cargo features select which ones are
compiled.

```toml
[dependencies]
rapiq = "0.0"                                                # core
# rapiq = { version = "0.0", features = ["parser-mongo"] }   # as parts land
```

| Feature | Crate | Module |
|---------|-------|--------|
| `core` (default) | `rapiq-core` | `rapiq::core` |

```rust
use rapiq::core::{expression, PlanOptions, Predicate};
use serde_json::json;

let filters = expression::parse(Some("eq(name, 'Peter')"))?;
let predicate = Predicate::compile(&filters, &PlanOptions::default())?;

assert!(predicate.test(&json!({ "name": "peter" })));
# Ok::<(), rapiq::core::Error>(())
```

Status: proof of concept. The API is not stable.

License: MIT.

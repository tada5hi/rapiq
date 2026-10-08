# Rust core (proof of concept)

A spike for moving rapiq's language-neutral logic into a Rust core with
bindings for TypeScript, Python and (later) Scala. Findings, measurements
and the go/no-go recommendation live in [SPIKE.md](SPIKE.md).

Nothing here is published, and nothing here is part of the npm workspaces
or the Nx graph: `npm run build`, `npm run test` and `npm run lint` behave
exactly as before (lint does cover the TypeScript and JavaScript files in
this directory).

## Layout

| Path | What |
|------|------|
| `rapiq-core/` | The Rust port: filter IR (`ir.rs`), schemaless expression filters parser (`expression.rs`), `planCondition` lowering (`plan.rs`), adapter-memory value semantics (`value.rs`) and filter evaluator with join-row binding (`eval.rs`), plus the JSON-string surface every binding wraps (`api.rs`) |
| `rapiq-node/` | napi-rs binding (`src/lib.rs`) plus a thin ESM wrapper (`index.js`, `index.d.ts`) that takes and returns plain objects |
| `rapiq-py/` | PyO3 / maturin binding: native module `rapiq._native` plus the `rapiq` package (`python/rapiq/__init__.py`) |
| `conformance/` | Shared fixtures (`fixtures/*.json`), their generator (`scripts/generate.ts`), the TS side of the IR (`src/ir.ts`), the vitest suite running the TS reference and the Rust binding side by side, and the Node benchmark |

## The IR

The FFI boundary is JSON strings: one serialization per call, not one object
conversion per AST node. Filter trees use an explicit `type` discriminant:

```json
{ "type": "filters", "operator": "and", "value": [
    { "type": "filter", "operator": "eq", "field": "name", "value": "admin" },
    { "type": "filter", "operator": "elemMatch", "field": "items",
      "value": { "type": "filter", "operator": "gt", "field": "$this", "value": 5 } }
] }
```

`crates/conformance/src/ir.ts` converts between this form and
`@rapiq/core`'s `Filter` / `Filters` (`toIR`, `fromIR`).

## Running it

Prerequisites: a Rust toolchain, Node 22, Python 3.9+ and a built monorepo
(`npm ci && npm run build`).

```bash
# Rust: unit tests + both fixture suites
cargo test --workspace

# Node binding: build rapiq.node, then run the fixtures against the TS
# reference and the Rust binding side by side
(cd crates/rapiq-node && npm run build)
(cd crates/conformance && npx vitest run --config test/vitest.config.ts)

# Python binding: build into a virtualenv, then run the fixtures
python -m venv .venv && . .venv/bin/activate
pip install maturin pytest
(cd crates/rapiq-py && maturin develop --release && pytest)

# Regenerate the fixtures from the TS reference (re-checks every
# hand-written verdict against @rapiq/adapter-memory)
node --experimental-strip-types crates/conformance/scripts/generate.ts

# Benchmarks
cargo run --release -p rapiq-core --example profile
node --experimental-strip-types crates/conformance/scripts/bench.ts
python crates/rapiq-py/scripts/bench.py
```

## Using the bindings

```js
import { compileFilters, parseExpressionFilters } from './crates/rapiq-node/index.js';

const filters = parseExpressionFilters("and(eq(name, 'Peter'), gte(age, '18'))");
const adults = compileFilters(filters).filter(users); // the caller's own objects
```

```python
import rapiq

filters = rapiq.parse_expression_filters("and(eq(name, 'Peter'), gte(age, '18'))")
adults = rapiq.compile_filters(filters).filter(users)  # the caller's own objects

try:
    rapiq.parse_expression_filters("eq(name")
except rapiq.RapiqError as error:
    error.code  # 'syntaxInvalid', the same ErrorCode value TypeScript uses
```

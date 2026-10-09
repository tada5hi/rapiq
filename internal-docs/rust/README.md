# Rust core and bindings

rapiq is moving its language-neutral logic into a Rust core with bindings for
TypeScript (Node and browsers), Python and later the JVM. This directory
holds the notes:

| Document | What |
|----------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Target structure, names, packaging per ecosystem, umbrellas, the binding pattern, the boundary, hooks |
| [DECISIONS.md](DECISIONS.md) | Dated decision log: settled, adopted, proposed and open, with rejected alternatives |
| [MIGRATION.md](MIGRATION.md) | The phases, open decisions and risks |
| [SPIKE.md](SPIKE.md) | The proof of concept: findings and measurements |
| [SCALA.md](SCALA.md) | JVM binding design note |
| this file | What exists today and how to build and run it |

External learnings: `.agents/references/rolldown.md`, `.agents/references/node-rs.md`.

The Rust crates and bindings are not published yet, and they are not part of
the npm workspaces or the Nx graph: `npm run build`, `npm run test` and
`npm run lint` cover the TypeScript packages exactly as before.

## Repository layout

Every rapiq package is a directory under `packages/`; its second level is the
ecosystem:

```
packages/<package>/node      npm package (@rapiq/<package>), TypeScript
packages/<package>/rust      Rust crate (rapiq-<package>)
packages/<package>/python    PyPI package (PyO3 binding)
packages/docs                documentation site (an app, no ecosystem level)
conformance/                 fixtures shared by every ecosystem
internal-docs/               design notes (this file)
```

Only `core` has a Rust and a Python part so far. The umbrellas exist for Rust
and Python (`packages/rapiq/{rust,python}`; npm waits for D7), and the
bindings share `packages/binding-support/rust`. Each package owns its
bindings (R7): the
napi-rs crate of a package lives inside its npm package, at
`packages/<package>/node/binding`, and will ship through per-platform npm
packages (`@rapiq/<package>-<platform>`). Crate names keep the `rapiq-`
prefix because crates.io has no namespaces; `cargo -p` takes that name.

| Path | Crate | What |
|------|-------|------|
| `packages/core/rust` | `rapiq-core` | The Rust port: filter IR (`ir.rs`), schemaless expression filters parser (`expression.rs`), `planCondition` lowering (`plan.rs`), adapter-memory value semantics (`value.rs`) and filter evaluator with join-row binding (`eval.rs`), plus the JSON-string surface every binding wraps (`api.rs`) |
| `packages/core/node/binding` | `rapiq-core-node` | napi-rs binding (`src/lib.rs`) plus a thin ESM wrapper (`index.js`, `index.d.ts`) that takes and returns plain objects; not yet wired into `@rapiq/core` |
| `packages/core/python` | `rapiq-core-py` | PyO3 / maturin binding, PyPI distribution `rapiq-core`: native module `rapiq.core._native` plus the `rapiq.core` package (`src/rapiq/core/__init__.py`, Python's src layout next to the Rust `src/lib.rs`; no `src/rapiq/__init__.py`, `rapiq` is a namespace, R11) |
| `packages/binding-support/rust` | `rapiq-binding-support` | Shared by every binding: mimalloc global allocator, `ErrorPayload` (P4) |
| `packages/rapiq/rust` | `rapiq` | Umbrella crate: re-exports the parts, selected by features (`core` default) (R10) |
| `packages/rapiq/python` | | Umbrella distribution `rapiq`: metadata only, depends on `rapiq-core`, extras select parts (R10) |
| `conformance/` | | Shared fixtures (`fixtures/*.json`), their generator (`scripts/generate.ts`), the TS side of the IR (`src/ir.ts`), the vitest suite running the TS reference and the Rust binding side by side, and the Node benchmark |

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

`conformance/src/ir.ts` converts between this form and
`@rapiq/core`'s `Filter` / `Filters` (`toIR`, `fromIR`).

## Running it

Prerequisites: a Rust toolchain, Node 22, Python 3.9+ and a built monorepo
(`npm ci && npm run build`).

```bash
# Rust: unit tests + both fixture suites
cargo test --workspace

# Node binding: build rapiq.node, then run the fixtures against the TS
# reference and the Rust binding side by side
(cd packages/core/node/binding && npm run build)
(cd conformance && npx vitest run --config test/vitest.config.ts)

# Python: build the rapiq-core wheel and the umbrella into a virtualenv,
# install the umbrella like a user would, then run the fixtures
python -m venv .venv && . .venv/bin/activate
pip install maturin build pytest
(cd packages/core/python && maturin build --release --out dist)
(cd packages/rapiq/python && python -m build --outdir dist .)
pip install --no-index --find-links packages/core/python/dist --find-links packages/rapiq/python/dist rapiq
(cd packages/core/python && python -m pytest)

# Regenerate the fixtures from the TS reference (re-checks every
# hand-written verdict against @rapiq/adapter-memory)
node --experimental-strip-types conformance/scripts/generate.ts

# Benchmarks
cargo run --release -p rapiq-core --example profile
node --experimental-strip-types conformance/scripts/bench.ts
python packages/core/python/scripts/bench.py
```

## Using the bindings

```js
import { compileFilters, parseExpressionFilters } from './packages/core/node/binding/index.js';

const filters = parseExpressionFilters("and(eq(name, 'Peter'), gte(age, '18'))");
const adults = compileFilters(filters).filter(users); // the caller's own objects
```

```python
from rapiq import core

filters = core.parse_expression_filters("and(eq(name, 'Peter'), gte(age, '18'))")
adults = core.compile_filters(filters).filter(users)  # the caller's own objects

try:
    core.parse_expression_filters("eq(name")
except core.RapiqError as error:
    error.code  # 'syntaxInvalid', the same ErrorCode value TypeScript uses
```

## CI and releases

- `.github/workflows/rust.yml` runs on every push and pull request: rustfmt,
  clippy, `cargo test` (unit tests, README doctests, both fixture suites), a
  crates.io packaging dry run of every publishable crate, the Node
  conformance suite on Linux, macOS and Windows, and the Python suite on
  CPython 3.9 and 3.13 (installed through the umbrella).
- `.github/workflows/rust-release.yml` is started by hand (Actions, "Rust
  release", choose `crates`, `pypi` or `all`, dry run on by default). It
  publishes `rapiq-core` and `rapiq` to crates.io, and to PyPI the
  `rapiq-core` abi3 wheels (Linux glibc and musl, x86_64 and aarch64; macOS
  x86_64 and aarch64; Windows x64) with an sdist plus the umbrella `rapiq`,
  all via trusted publishing (no stored tokens).

One-time setup before the first non-dry run:

1. crates.io: publish the first version of both crates by hand (`cargo login`,
   then `cargo publish --workspace`; a trusted publisher can only be added to
   an existing crate), then add this repository and `rust-release.yml` under
   each crate's "Trusted Publishing" settings, and add the GitHub team as
   owner (`cargo owner --add github:<org>:<team> rapiq-core`, same for `rapiq`).
2. PyPI: add a pending trusted publisher for each project, `rapiq-core` and
   `rapiq` (owner `tada5hi`, repository `rapiq`, workflow `rust-release.yml`,
   environment `pypi`).
3. GitHub: optionally protect the `crates-io` and `pypi` environments with
   required reviewers.


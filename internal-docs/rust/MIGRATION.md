# Migration plan: TypeScript packages on top of the Rust core

Goal: one implementation of rapiq's semantics (R1). The TypeScript packages
stop carrying their own parser, schema-resolution, filter-semantics, codec,
SQL-rendering and evaluation logic and call the Rust core instead; Python
(and later the JVM) get the same core through their own bindings. Only the
adapters that exist to drive a TypeScript library keep their own code:
`@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle`.

This file is the order of work. Companion documents:

- [ARCHITECTURE.md](ARCHITECTURE.md): target structure, names, packaging per
  ecosystem, umbrellas, the binding pattern, the boundary, hooks.
- [DECISIONS.md](DECISIONS.md): dated decision log (R*n* settled or adopted,
  P*n* proposed), including rejected alternatives.
- [SPIKE.md](SPIKE.md): the proof of concept and its measurements.
- `.agents/references/rolldown.md`, `.agents/references/node-rs.md`: what was
  learned from those projects.

## Phases

Each phase ships when the existing test suites of every affected package pass
**unchanged** on top of Rust, and it deletes the TS implementation it
replaces in the same change. "Fixtures" means the shared conformance fixtures
generated from the TS reference before it is deleted.

### Phase 0: foundations

- IR v1 for all parameters and for schemas. `schema.describe()` already
  serializes the declarative part; extend it with `mapping`, `schemaMapping`,
  defaults and a hook marker per parameter.
- `toIR` / `fromIR` move into `@rapiq/core` (from `conformance/src/ir.ts`).
- Fixture generator covering every package's spec inputs, snapshotting the
  TS reference: the safety net for every later phase.
- Fixtures move next to their package (`packages/<package>/fixtures/`, P7);
  `conformance/` keeps the shared runner.
- Workspace hygiene (P6): `rust-toolchain.toml`, `[workspace.dependencies]`,
  `[workspace.lints]`, `strip = "symbols"`; Cargo members as globs
  (`packages/*/rust`, `packages/*/node/binding`, `packages/*/python`).
- `packages/binding-support/rust` (P4): mimalloc allocator, JSON boundary
  helpers, error conversion; the core bindings switch to it.
- `@rapiq/core`'s binding becomes a real napi package (R7, R8, P1, P2): a
  `napi` block in `@rapiq/core`'s `package.json` (package name
  `@rapiq/core`; targets linux x64 and arm64 gnu and musl, macOS x64 and
  arm64, windows x64, `wasm32-wasip1-threads`), generated ESM loader and
  `index.d.ts` committed, `npm/` gitignored and generated at publish.
- The factory-over-binding shape (P3) in `@rapiq/core`: `src/index.ts`
  (native) and `src/browser.ts` (WASM) behind an `exports` `browser`
  condition, with the binding loaded but not yet used by the API.
- WASM: build both napi `wasm32-wasip1-threads` and a wasm-bindgen variant,
  measure size and browser constraints, decide D2.
- Python (R11): rename `packages/core/python` from distribution `rapiq` /
  import `rapiq` to `rapiq-core` / `rapiq.core` (namespace package).
- Umbrellas (R10): `packages/rapiq/rust` (crate `rapiq`, feature `core`) and
  `packages/rapiq/python` (distribution `rapiq`, extra `core`, no code);
  `packages/rapiq/node` once D7 is decided.
- CI by target (P5): one build job per target for every Rust-backed package,
  uploading `bindings-<target>`; tests per platform (Docker for musl and ARM,
  Node 22 and 24, WASI); the conformance suite against both napi and WASM;
  replaces the per-package Node job in `.github/workflows/rust.yml`.
- Release: release-please gains the crates, the Python distributions and the
  npm platform packages in the linked group (D6); publish order: platform
  packages, then the packages depending on them, then the umbrellas. The
  manual `rust-release.yml` folds into it. Trusted publishers: crates.io
  `rapiq-core` and `rapiq`, PyPI `rapiq-core` and `rapiq`.
- Developer setup: building the workspace needs `cargo`; document it in
  `AGENTS.md` and `.agents/conventions.md`. Committed loaders and type
  declarations (P2) keep TS-only work possible without cargo.

Exit: `@rapiq/core` with its platform and WASM packages, `rapiq-core` on
crates.io and PyPI, and both umbrellas publish as betas from CI, with the
binding loaded but not yet used by the TS API.

### Phase 1: filter semantics

Port: `FILTER_OPERATOR_SEMANTICS`, `planCondition`, `distributeNegation`,
`interpretPlan` dispatch (the support matrix), `Filters.flatten`. The spike
already covers `planCondition`.

TS after: `planCondition(condition, options)` = `fromPlanIR(binding.plan(toIR(condition), options))`;
`IPlanInterpreter` stays as the TS adapter contract. Consumers: sql, typeorm,
memory, prisma, drizzle.

Deleted: `packages/core/node/src/parameter/filters/plan/` (about 1,100 lines).

### Phase 2: merge and build

Port: `mergeQueries` and the per-parameter `merge` rules (keyed left
priority, monotonic filter conjunction, the `MergeError` refusals), the
`define*` desugaring (`defineQuery` input to IR), `findGroupColumnDuplicate`,
`resolveGroupedSorts`, `assertGroupedQuery`.

Deleted: `parameter/merge.ts`, the per-parameter `merge` methods and most of
`build/` (about 1,700 lines). The typed `define*` signatures stay.

### Phase 3: schema model and resolution

Port: `ResolutionScope` (aliases, allow-lists, relation traversal,
`schemaMapping`), `SchemaRegistry` lookups, call-term normalization
(`resolveCallTerm`), index policies, relation pruning, issue collection.

The TS `Schema` / `SchemaRegistry` keep their API and own the hook
functions; each serializes its declarative part once (cached, invalidated on
`registry.add`) and the native side keeps it behind a handle, so a parse does
not re-send the schema.

Deleted: `schema/resolver/`, `schema/indexes/`, the declarative parts of
`schema/parameter/`, most of `parser/` (up to about 7,000 lines).

### Phase 4: parsers

Port: the simple dialect (shared filter-value wire grammar, call-term
grammar, groups/aggregates parsers), the expression dialect (done in the
spike for filters), the mongo dialect. The three-step hook protocol lands
here.

Deleted: nearly all of `parser-simple`, `parser-expression`, `parser-mongo`
(about 5,900 lines); each package keeps its parser class as a thin façade so
imports do not change.

### Phase 5: URL codec

Port: `qs`-compatible query-string parsing and serialization (only the
subset rapiq emits and accepts, pinned by fixtures), wire-name mapping, the
expression and simple strategies, stamp and `detect` dispatch,
schema-aware encode. Custom dialect registration stays possible: a
registered TS dialect is called from the façade, built-in ones run in Rust.

Deleted: most of `codec-url` (about 3,000 lines) and the `qs` dependency.

### Phase 6: SQL rendering

Port: the dialect presets (as data), LIKE escaping, case folding, bucket
formats, the grouped clause builder, `normalizeGroupedRows`.

Deleted: the rendering half of `adapter-sql`. What happens to its exported
base classes is decision D3.

### Phase 7: in-memory evaluation

Port: done in the spike for filters; add sorts, fields (including
`applyFieldConditions`), pagination and grouped evaluation. Shape depends on
decision D4.

### Phase 8: other languages

Every Rust-backed package gets its `python/` part as soon as its `rust/` part
exists (each a separate wheel under the `rapiq.` namespace, R11), and the
umbrellas gain a feature / extra per part (R10). Phases 1 to 5 are the
surface a non-JS server needs (parse, validate against a schema, merge,
plan), so that is when the Python parts are announced as usable. The JVM
binding follows SCALA.md. ORM adapters for these ecosystems are new code.

## Decisions needed

**D1. Schema hooks protocol.** The three-step protocol above, or restrict
hooks to post-processing the final IR (simpler, but changes when hooks run
relative to defaults and pruning, which is observable and documented).
Recommendation: three steps; it preserves behavior exactly.

**D2. WASM in the browser.** Ship `ready()` as a new API, or keep a pure-TS
build of the client-side subset (`defineQuery`, `encode`) so browsers never
load WASM. The second reintroduces duplication for exactly the encode path.
Recommendation: `ready()`, and measure the WASM size in phase 0 (budget to
agree; the spike's filter slice is small, the full core with `regex` will
not be).
Toolchain: napi-rs's `wasm32-wasip1-threads` target (rolldown's choice, one
Rust API for both outputs) needs `SharedArrayBuffer`, i.e. cross-origin
isolated pages, in browsers; a wasm-bindgen build works on any page but is a
second, thin binding layer. Build both in phase 0 and decide on evidence.

**D3. `adapter-sql`'s extension surface.** Its exported base classes,
including protected members, are subclassed by `adapter-typeorm` and
documented as an external extension point. Options:
(a) Rust renders standalone SQL; the base classes stay in TS as an
interpreter of the Rust plan for typeorm and external subclassers (some
rendering code remains in TS);
(b) typeorm stops subclassing and renders from the plan itself, adapter-sql
becomes a pure façade (breaking for external subclassers);
(c) Rust exposes rendering hooks (callbacks per fragment), keeping the
classes (complex, slow across the boundary).
Recommendation: (a) for v2, revisit after GA.

**D4. `adapter-memory` performance.** Measured in the spike: evaluating JS
objects in Rust is 4 to 5x slower than the TS predicate, because records
must be serialized to cross the boundary. Options:
(a) accept the regression for one implementation;
(b) TS keeps a thin interpreter of the Rust plan (all operator semantics in
Rust, about 300 lines of primitive tests and binding enumeration in TS);
(c) per-field napi object access instead of JSON (removes serialization,
not available in WASM).
Recommendation: (b): the semantics are not duplicated, only their
primitive execution, and the 300 lines are pinned by the shared fixtures.

**D5. Error identity.** Rust returns code, message and issue trace; TS builds
the branded error. Confirm that error messages are allowed to come from Rust
verbatim (they do in the spike, matching byte for byte).

**D6. Version coupling.** The platform packages, crates and Python
distributions join the linked release group (lockstep), or version
independently behind a protocol version check. Recommendation: lockstep
while in beta.

**D7. npm umbrella name.** R10 asks for an npm umbrella too. The npm name
`rapiq` is the v1 package (latest `1.0.0`), so the umbrella would be
`rapiq@2.0.0`: one install pulling in every `@rapiq/*` part, which doubles
as a migration path for v1 users. Alternative: a new name. Recommendation:
`rapiq@2`.

## Risks

- **Dependency weight and install failures**: native addons fail in some
  environments (exotic libc, locked-down CI). The WASM fallback covers them,
  but must be tested as a first-class path, not a fallback nobody runs.
- **JavaScript-semantics drift**: the spike found six places where a naive
  port silently differs (number parsing, whitespace, number formatting,
  string ordering, UTF-16 positions, `-0`). Every phase must extend the
  fixtures before porting, never after.
- **Regex dialect**: the `regex` operator and anchored matching change
  engine (Rust `regex` versus JS `RegExp`). Either document the dialect or
  keep regex evaluation on the host for memory.
- **Contributor friction**: every TS contributor needs a Rust toolchain to
  build the workspace (or published binding prereleases pinned in
  dev, which then goes stale against local Rust changes).
- **Package count**: bindings per package (R7, R11) multiply artifacts:
  Rust-backed packages × platforms on npm and PyPI. Generation (P1) keeps it
  mechanical, but every release publishes all of them.
- **Scale**: about 25,000 lines of TS are in scope. Phases 3 and 4 are the
  bulk and carry the hook protocol; expect several sessions each.

## Suggested first increment after this plan is approved

Phase 0 plus phase 1 together: the smallest change that puts real code on
the new path (five adapters consume `planCondition`), proves the release
pipeline end to end, and deletes about 1,100 lines of TS.

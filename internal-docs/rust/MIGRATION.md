# Migration plan: TypeScript packages on top of the Rust core

Goal: one implementation of rapiq's semantics. The TypeScript packages stop
carrying their own parser, schema-resolution, filter-semantics, codec,
SQL-rendering and evaluation logic and call the Rust core instead. Only the
adapters that exist to drive a TypeScript library keep their own code:
`@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle`.

Settled for this plan (maintainer, 2026-10-08):

- **Runtime**: napi native addon on Node, WASM fallback everywhere else
  (browsers, unsupported platforms, edge runtimes).
- **Order**: plan first; code lands phase by phase, each phase deleting the
  TypeScript implementation it replaces.

Settled 2026-10-09:

- **Layout**: `packages/<package>/<ecosystem>` (`node`, `rust`, `python`, later
  `jvm`); the former top-level `crates/` directory is gone.
- **Bindings per package**: each rapiq package owns its native addon (no
  shared binding package). The napi crate lives inside the npm package at
  `packages/<package>/node/binding`.
- **Per-platform npm packages**: each addon ships as optional dependencies
  `@rapiq/<package>-<platform>`, of which npm installs only the matching one.

Background and measurements: [SPIKE.md](SPIKE.md).

## Target architecture

```
packages/core/rust           rapiq-core: IR, schema resolution, merge, filter
                             semantics, issue traces
packages/core/node           @rapiq/core: public TS API (classes, visitor
                             interfaces, defineQuery/defineSchema, error
                             classes, hook driving); logic delegated to
packages/core/node/binding     rapiq-core-node (napi-rs) ─┐
                                                          ├ @rapiq/core-<platform>
                                                          ┘ (+ WASM fallback)
packages/core/python         rapiq (PyPI): PyO3 binding of rapiq-core
packages/core/jvm            JNI binding (later)

packages/parser-*/rust       rapiq-parser-*: grammars (depend on rapiq-core)
packages/parser-*/node       thin: option mapping + hook driving, own binding
packages/codec-url/rust      qs-compatible wire format, dialect dispatch
packages/codec-url/node      thin façade, own binding
packages/adapter-sql/rust    SQL rendering, dialect presets as data
packages/adapter-sql/node    thin façade (see D3)
packages/adapter-memory/rust in-memory evaluation
packages/adapter-memory/node see D4
packages/adapter-typeorm/node   TS only, consumes the Rust plan
packages/adapter-prisma/node    TS only, consumes the Rust plan
packages/adapter-drizzle/node   TS only, consumes the Rust plan
```

Bindings per package have one structural consequence: two addons (say
`@rapiq/core` and `@rapiq/parser-mongo`) each link their own copy of
`rapiq-core` and share no memory, so nothing crosses between packages except
the JSON IR. In particular a native handle (a compiled schema, a predicate)
belongs to the addon that created it.

### Learnings from rolldown

rolldown (the Rust bundler with a TS API, napi-rs, pnpm and Cargo
workspaces) was reviewed on 2026-10-09:

- It keeps Rust crates (`crates/`) and npm packages (`packages/`) in separate
  trees and ships **one** binding crate (`rolldown_binding`, `publish = false`)
  for the whole project; rapiq deliberately differs (bindings per package),
  trading binary size and package count for package independence.
- Platform packages are generated, not hand-written: `napi artifacts` /
  `napi pre-publish` derive `@rolldown/binding-<target>` from the `napi`
  block in the main `package.json` (binary name, package name, targets list).
  rapiq adopts this per package.
- The WASM fallback is napi-rs's own `wasm32-wasip1-threads` target (with
  `@napi-rs/wasm-runtime` and a browser `asyncInit` option), published as a
  separate browser package, rather than a second wasm-bindgen binding. The
  threads runtime needs `SharedArrayBuffer` (cross-origin isolated pages) in
  browsers; whether that is acceptable for rapiq's client side is part of D2.
- Toolchain pinned in `rust-toolchain.toml`; lints and dependency versions
  centralized in the Cargo workspace (`[workspace.lints]`,
  `[workspace.dependencies]`); almost every crate is `publish = false`.


### What stays TypeScript, by necessity

| Stays in TS | Why |
|-------------|-----|
| Public classes (`Query`, `Filters`, `Filter`, `Fields`, ...) and `accept(visitor)` | The public API and every adapter are built on them; they become plain carriers hydrated from the IR (`fromIR`) |
| Type layer (`NestedKeys<T>`, `defineQuery<RECORD>`, typed `define*` input) | Compile-time only |
| Running user hooks (`validate`, `validateMany`, field visibility gates, relations validators) | User functions, sync or async; see "Hooks" |
| Error classes and the `Symbol.for` brand | `isParseError` across copies must keep working; Rust supplies code, message and issue trace, TS constructs the branded error |
| Custom `ICondition` kinds | Opaque to Rust by design (already opaque to built-in logic today) |
| typeorm / prisma / drizzle adapters | They drive TS libraries |

### The boundary

- **Coarse calls, JSON IR.** One call per parse, merge, plan or render, never
  one per node. The IR covers every parameter (fields, filters, sorts,
  pagination, relations, groups, aggregates) and schemas.
- **Synchronous.** `parse()` and friends are synchronous today and must stay
  so. napi calls are synchronous. WASM must be instantiated before first use:
  the loader compiles the module synchronously where the platform allows it
  (Node, workers) and exports `ready(): Promise<void>` for browser main
  threads, which restrict synchronous compilation of large modules. A
  synchronous call before `ready()` resolves throws a typed error. This is
  the one user-visible API addition of the migration.
- **Custom conditions** cross as `{ "type": "custom", "ref": n }`; the TS side
  keeps a per-call table and re-inserts the original objects when hydrating.
  Rust treats them as opaque leaves that traverse no relation, which is the
  current documented semantics.

### Hooks

A parse becomes three steps, all behind the existing `parse()` /
`parseAsync()` signatures:

1. **Rust `resolve`**: grammar, key resolution against the serialized schema,
   allow-lists, defaults, coercion. Returns the IR plus the list of nodes that
   have hooks to run, plus the issue trace so far.
2. **TS `validate`**: runs the hooks (sync in `parse()`, awaited in order in
   `parseAsync()`, thenable refusal unchanged). Hook answers (accept, drop,
   replacement `ICondition`, rejection) are serialized back.
3. **Rust `finalize`**: applies the answers, relation pruning, preserve
   checks, index policies, grouped-mode rules, issue aggregation.

Schemas without hooks skip step 2, and steps 1 and 3 can then be fused into
one call.

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
- `@rapiq/core`'s binding (`packages/core/node/binding`) becomes a real napi
  package: a `napi` block in `@rapiq/core`'s `package.json`, prebuilds via
  `@napi-rs/cli` (linux x64 and arm64 gnu and musl, macOS x64 and arm64,
  windows x64), generated `@rapiq/core-<platform>` packages as optional
  dependencies, a loader, and the WASM fallback (napi-rs `wasm32-wasip1-threads`
  or wasm-bindgen, decided by D2). Later packages copy the setup.
- CI: Rust job (fmt, clippy, test), napi build matrix, WASM build with a size
  budget, the conformance suite against both napi and WASM.
- Release: release-please gains the Rust crates and the platform packages in
  the linked group; publish order: platform packages, then the package that
  depends on them.
- Pin the toolchain (`rust-toolchain.toml`) and move lints and shared
  dependency versions into `[workspace.lints]` / `[workspace.dependencies]`.
- Developer setup: building the workspace now needs `cargo` and the wasm
  target; document it in `AGENTS.md` and `.agents/conventions.md`.

Exit: `@rapiq/core` and its platform packages publish as a beta from CI on
all targets, with the binding loaded but not yet used.

### Phase 1: filter semantics

Port: `FILTER_OPERATOR_SEMANTICS`, `planCondition`, `distributeNegation`,
`interpretPlan` dispatch (the support matrix), `Filters.flatten`. The spike
already covers `planCondition`.

TS after: `planCondition(condition, options)` = `fromPlanIR(binding.plan(toIR(condition), options))`;
`IPlanInterpreter` stays as the TS adapter contract. Consumers: sql, typeorm,
memory, prisma, drizzle.

Deleted: `packages/core/src/parameter/filters/plan/` (about 1,100 lines).

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

Python and JVM bindings become release artifacts once phases 1 to 5 are in,
since that is the surface a non-JS server needs (parse, validate against a
schema, merge, plan). Their ORM adapters are new code per ecosystem.

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

**D6. Version coupling.** The platform packages join the linked release group
(lockstep), or versions independently behind a protocol version check.
Recommendation: lockstep while in beta.

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
- **Scale**: about 25,000 lines of TS are in scope. Phases 3 and 4 are the
  bulk and carry the hook protocol; expect several sessions each.

## Suggested first increment after this plan is approved

Phase 0 plus phase 1 together: the smallest change that puts real code on
the new path (five adapters consume `planCondition`), proves the release
pipeline end to end, and deletes about 1,100 lines of TS.

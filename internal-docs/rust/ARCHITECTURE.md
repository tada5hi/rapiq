# Architecture: Rust core and bindings

The target structure and the concepts behind it. Why each choice was made,
and what was rejected, is in [DECISIONS.md](DECISIONS.md) (referenced as
R*n* / P*n*); the order of work is in [MIGRATION.md](MIGRATION.md).

## Repository structure

Every rapiq package is a directory under `packages/`, with one directory per
ecosystem below it (R5):

```
packages/<package>/rust             crate rapiq-<package>
packages/<package>/node             npm package @rapiq/<package> (TypeScript)
packages/<package>/node/binding     napi crate rapiq-<package>-node (R7)
packages/<package>/node/npm/        generated platform packages, gitignored (R8)
packages/<package>/python           PyPI distribution rapiq-<package> (R11)
packages/<package>/fixtures/        conformance fixtures of the package (P7)
packages/rapiq/{rust,python,node}   umbrella per language (R10)
packages/binding-support/rust       shared binding support crate (P4)
packages/docs                       documentation site (no ecosystem level)
conformance/                        shared conformance runner (fixtures today)
internal-docs/rust/                 these notes
```

Target, once the migration is done:

```
packages/core/rust               rapiq-core: IR, schema resolution, merge, filter
                                 semantics, issue traces
packages/core/node               @rapiq/core: public TS API (classes, visitor
                                 interfaces, defineQuery/defineSchema, error
                                 classes, hook driving); logic delegated to
packages/core/node/binding         rapiq-core-node ─┐ @rapiq/core-<platform>
                                                    ┘ @rapiq/core-wasm32-wasi
packages/core/python             rapiq-core (PyPI), import rapiq.core
packages/core/jvm                JNI binding (later, see SCALA.md)

packages/parser-*/rust           rapiq-parser-*: grammars (depend on rapiq-core)
packages/parser-*/node           thin: option mapping + hook driving, own binding
packages/parser-*/python         rapiq-parser-* (PyPI), import rapiq.parser_*
packages/codec-url/rust          qs-compatible wire format, dialect dispatch
packages/codec-url/node          thin façade, own binding
packages/adapter-sql/rust        SQL rendering, dialect presets as data
packages/adapter-sql/node        thin façade (D3)
packages/adapter-memory/rust     in-memory evaluation
packages/adapter-memory/node     D4
packages/adapter-typeorm/node    TS only, consumes the Rust plan
packages/adapter-prisma/node     TS only, consumes the Rust plan
packages/adapter-drizzle/node    TS only, consumes the Rust plan

packages/rapiq/rust              rapiq (crates.io): features select parts
packages/rapiq/python            rapiq (PyPI): extras select parts
packages/rapiq/node              rapiq (npm): everything (D7)
```

State today: only `core` has `rust`, `node/binding` and `python`;
`binding-support` and the Rust and Python umbrellas exist; the npm umbrella
(D7) and per-package fixtures do not yet.

## Names

Directories never carry the `rapiq-` prefix; published names always do where
the registry has no namespaces (R6).

| Package | npm | crates.io | PyPI | Python import |
|---------|-----|-----------|------|---------------|
| core | `@rapiq/core` (+ `@rapiq/core-<platform>`, `@rapiq/core-wasm32-wasi`) | `rapiq-core` | `rapiq-core` | `rapiq.core` |
| parser-mongo | `@rapiq/parser-mongo` (+ platform packages) | `rapiq-parser-mongo` | `rapiq-parser-mongo` | `rapiq.parser_mongo` |
| adapter-typeorm | `@rapiq/adapter-typeorm` | | | |
| umbrella | `rapiq` (D7) | `rapiq` | `rapiq` | (namespace only) |
| binding crates | | `rapiq-<package>-node`, `rapiq-<package>-py`, `publish = false` | | |

## Packaging per ecosystem

- **npm** (R7, R8): an npm package with Rust behind it carries a `napi` block
  in its `package.json` (P1). `@napi-rs/cli` builds the addon, generates the
  loader and type declarations (committed, ESM; P2), and at publish time the
  platform packages, which become optional dependencies. The WASM build is
  published as `@rapiq/<package>-wasm32-wasi` (toolchain: D2).
- **crates.io**: the part crates `rapiq-<package>` and the umbrella `rapiq`
  are published; binding crates are not.
- **PyPI** (R11): one abi3 wheel per platform per part, plus the umbrella
  `rapiq` with extras and no code. Parts share the `rapiq.` namespace.
- **Maven**: later, see [SCALA.md](SCALA.md).

### Umbrellas (R10)

One per language, each with that ecosystem's way of choosing parts: Cargo
features (only selected parts compile), Python extras (only selected wheels
install), and for npm the scoped packages themselves (the umbrella installs
everything). They contain no logic of their own.

### Cross-package boundary

Each package's native code is a separate addon or extension module, each
linking its own copy of `rapiq-core` (R7, R11). Consequences:

- Data crosses between packages only as the JSON IR.
- A native handle (compiled schema, predicate) is usable only by the package
  that created it; another package receives the serialized form and may
  cache it by content.
- Binary size grows with the number of Rust-backed packages a user installs.

## The binding pattern (P3)

A Rust-backed npm package builds its public API as a factory over a binding:

```
src/module.ts    createApi(binding): the public API, written once
src/index.ts     export createApi(native binding)       (Node, "default")
src/browser.ts   export createApi(WASM package)         ("browser" condition)
```

The generated loader stays untouched by hand (it is regenerated on every
build). The same shape lets tests inject a binding.

## The boundary (R4)

- **Coarse calls, JSON IR.** One call per parse, merge, plan or render. The IR
  covers every parameter (fields, filters, sorts, pagination, relations,
  groups, aggregates) and schemas; filter trees carry an explicit `type`
  discriminant (see [README.md](README.md#the-ir)).
- **Synchronous.** `parse()` and friends stay synchronous. napi calls are.
  WASM must be instantiated before first use: compiled synchronously where
  the platform allows it (Node, workers); browser main threads get
  `ready(): Promise<void>`, the one user-visible API addition (D2). A call
  before `ready()` resolves throws a typed error.
- **Custom conditions** cross as `{ "type": "custom", "ref": n }`; the TS side
  keeps a per-call table and re-inserts the original objects when hydrating.
  Rust treats them as opaque leaves that traverse no relation, which is the
  current documented semantics.
- **Errors**: Rust returns code, message and issue trace; the host builds the
  branded error (`isParseError` must keep working across package copies).

## What stays TypeScript

| Stays in TS | Why |
|-------------|-----|
| Public classes (`Query`, `Filters`, `Filter`, `Fields`, ...) and `accept(visitor)` | The public API and every adapter are built on them; they become carriers hydrated from the IR (`fromIR`) |
| Type layer (`NestedKeys<T>`, `defineQuery<RECORD>`, typed `define*` input) | Compile-time only |
| Running user hooks (`validate`, `validateMany`, field visibility gates, relations validators) | User functions, sync or async; see "Hooks" |
| Error classes and the `Symbol.for` brand | Identity across package copies |
| Custom `ICondition` kinds | Opaque to Rust by design |
| typeorm / prisma / drizzle adapters | They drive TS libraries |

## Hooks (D1)

A parse becomes three steps, all behind the existing `parse()` /
`parseAsync()` signatures:

1. **Rust `resolve`**: grammar, key resolution against the serialized schema,
   allow-lists, defaults, coercion. Returns the IR, the nodes that have hooks
   to run, and the issue trace so far.
2. **Host `validate`**: runs the hooks (sync in `parse()`, awaited in order in
   `parseAsync()`, thenable refusal unchanged); answers (accept, drop,
   replacement condition, rejection) are serialized back.
3. **Rust `finalize`**: applies the answers, relation pruning, preserve
   checks, index policies, grouped-mode rules, issue aggregation.

Schemas without hooks skip step 2; steps 1 and 3 then fuse into one call.
The same protocol serves every host language.

## Reproducing JavaScript semantics

The TS packages are the reference, so the Rust port reproduces JavaScript
behavior where a naive port differs. Found by the spike, each covered by a
fixture or unit test (`packages/core/rust/src/number.rs`, `value.rs`):

- `Number(string)` grammar (Rust's `f64::from_str` accepts `inf`/`nan`,
  rejects `0x1F`).
- `String.prototype.trim` / regex `\s` whitespace set (differs on U+0085 and
  U+FEFF).
- `Number.prototype.toString` formatting (`ryu-js`).
- String ordering by UTF-16 code units, error positions in UTF-16 units.
- `-0` normalizes to `0` on the wire.

Rule: extend the fixtures before porting a piece, never after.

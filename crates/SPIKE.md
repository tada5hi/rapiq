# Rust core spike: findings

Question: can rapiq's language-neutral logic move into a Rust core consumed
from TypeScript, Python and Scala, while existing JS users keep an
idiomatic API? This spike ported one end-to-end slice and measured it.
Layout and run instructions: [README.md](README.md). Scala: [SCALA.md](SCALA.md).

## Verdict

- **Semantics port cleanly.** The expression filters parser, `planCondition`
  and the adapter-memory evaluator (join-row binding, elemMatch scopes,
  ITSELF, complement law, case folding) reproduce the TypeScript reference
  on every shared fixture: 98 parser inputs and 171 evaluation groups, green
  in Rust (`cargo test`), through napi (541 vitest cases, TS and Rust side
  by side) and through PyO3 (273 pytest cases). Two deliberate mutations of
  the port were caught by the fixtures.
- **There is no performance case for JavaScript users.** Rust parses about
  6x faster natively, but the boundary eats most of it; for in-memory
  evaluation V8 on its own objects is 4 to 5x faster than Rust on JSON text.
- **The case for Rust is reach, not speed:** one implementation of the
  settled semantics for Python and the JVM instead of a port per language.
  It is worth paying only if Python or Scala consumers are real.

## What was built

| Piece | Lines (approx.) | Notes |
|-------|-----------------|-------|
| `rapiq-core` | 2,450 Rust (incl. unit tests) | IR, parser, lowering, value semantics, evaluator, JSON API |
| `rapiq-node` | 55 Rust + 55 JS | napi-rs; errors carry the rapiq `ErrorCode` as `code` |
| `rapiq-py` | 80 Rust + 110 Python | PyO3 abi3 (one wheel per platform for CPython 3.9+); `filter` releases the GIL |
| `conformance` | 1,200 TS + fixtures | generator, IR helpers, side-by-side suite, benchmark |

The IR is JSON with an explicit `type` discriminant. The TS side
(`toIR`/`fromIR`) is 85 lines; the Rust side 230.

## What ported cleanly

- The tokenizer and recursive-descent parser map one to one, including the
  regex-engine backtracking on an unterminated doubled quote, keyword
  classification on whole identifiers, the depth cap and error messages.
- The operator-semantics table becomes a `match`; plan nodes become an enum.
  Negation normalization (`not(eq)` to `ne`, double negation) is identical.
- The binding enumeration ports directly; slots become indices instead of
  map keys.

## Where JavaScript semantics had to be reproduced by hand

These are the places a naive port silently diverges. Each is now handled
and covered by a fixture or a unit test:

- `Number(string)`: Rust's `f64::from_str` accepts `inf`, `nan` and
  `infinity` and rejects `0x1F`; JS is the reverse. Reimplemented.
- `String.prototype.trim` and the regex `\s` class: Rust's whitespace
  includes U+0085 and excludes U+FEFF; JS is the reverse. Reimplemented.
- `Number.prototype.toString` (anchored matching stringifies numbers, e.g.
  `1e21` to `1e+21`): via the `ryu-js` crate.
- String ordering: JS `<` compares UTF-16 code units, Rust compares code
  points; they disagree between U+E000..U+FFFF and astral characters.
- Error positions are reported in UTF-16 units.
- `-0`: JSON has none, so both sides normalize it to `0` on the wire.

## Accepted divergences

- **Non-finite literals.** `eq(age, 'Infinity')` yields the number Infinity in
  TS, which JSON cannot carry; Rust keeps the string.
- **Dates and RegExp values** do not exist in JSON. Date coercion
  (memory's `alignDates`) is not ported; a `regex` operand must be a string.
- **Regex dialect.** The `regex` operator runs on Rust's `regex` crate: no
  look-around or backreferences (refused as `featureUnsupported`), and
  slightly different Unicode case folding for exotic characters (Kelvin
  sign) under `i`. The same caveat applies to anchored matching, which
  uses the crate with escaped literals.
- **Error envelope.** Rust returns the leaf issue code (`syntaxInvalid`, ...);
  the `INPUT_REJECTED` trace wrapper of a TS `parse()` belongs to the
  not-ported schema/trace layer.

## Measurements

Shared 4-core Xeon container; allocation-heavy timings varied by up to 10x
between runs (fresh-memory page faults are expensive in this sandbox), so read
ratios, not absolutes. Expression: 169 characters (and, or, eq, startsWith,
gte, elemMatch with in, not(contains)). Records: 100,000 objects, 17.2 MB as
JSON.

| Node.js | µs |
|---------|----|
| TS `parse()` | 20.5 |
| Rust `parse()` natively (no binding) | 3.2 |
| Rust `parse()` natively, incl. IR JSON string | 4.5 |
| Rust via napi, JSON string out | 6.8 |
| Rust via napi + `JSON.parse` to an object | 12.9 |
| TS predicate, one record | 1.1 |
| Rust via napi, one pre-serialized record | 3.1 |
| Rust via napi, one record incl. `JSON.stringify` | 4.2 |

| Node.js, 100k records | ms |
|-----------------------|----|
| TS `records.filter(predicate)` | 146 |
| TS `JSON.parse` + filter (records arriving as text) | 407 |
| Rust via napi, records as text (decode + evaluate) | 671 |
| Rust via napi incl. `JSON.stringify` | 836 |
| Rust natively, evaluate already-decoded `serde_json` values | 107 to 156 |
| Rust natively, `serde_json` decode alone | 360 to 3,800 |

| Python (no Python reference exists, so throughput only) | |
|---------------------------------------------------------|----|
| Rust `parse()`, JSON string out | 5.3 µs |
| Rust `parse()` + `json.loads` to a dict | 14.7 µs |
| one pre-serialized record | 2.4 µs |
| one record incl. `json.dumps` | 7.6 µs |
| 100k records as text (decode + evaluate) | 617 ms |
| 100k records incl. `json.dumps` | 925 ms |
| `json.dumps(records)` alone | 282 ms |

For Python the comparison that matters is a pure-Python port, which does
not exist yet; a hand-written interpreter over dicts would likely land in
the same range as the "incl. `json.dumps`" row, so the binding is
competitive there without being a decisive win either.

Why the evaluator does not win:

- Crossing the boundary means serializing records. `JSON.stringify` of the
  record set alone costs about as much as TS evaluating it.
- On the Rust side, decoding to a `serde_json::Value` DOM dominates, and the
  DOM is cache-unfriendly: even `gte(age, '18')` costs about 0.57 µs per record
  natively because every record is a separately allocated map. V8's
  hidden-class objects are compact and the TS predicate is JIT-compiled.
- Faster paths exist (typed `serde` structs, `simd-json`, a zero-copy
  `serde_json::value::RawValue` walk, napi object access without JSON), but
  each trades away the generic record shape or reintroduces per-field FFI
  calls. None changes the conclusion for JS users holding objects.

Two profiling-driven fixes landed during the spike: serializing the IR
directly instead of through a `Value` (13.2 to 4.5 µs) and an ASCII fast
path for case-folded equality.

## Build and CI implications

- **npm**: a native addon needs prebuilt binaries per target (linux x64 and
  arm64, glibc and musl; macOS x64 and arm64; windows x64: 7 artifacts),
  shipped as per-platform optional dependencies (`@napi-rs/cli` automates
  the layout and the GitHub Actions matrix). The browser needs a separate
  WASM build of the same crate; the client side of rapiq (`defineQuery`,
  `encode`) runs in browsers, so TS would ship a native addon, a WASM module
  and a JS fallback, or stay pure TS on the client.
- **PyPI**: `maturin` with abi3 needs one wheel per platform (manylinux x64
  and aarch64, musllinux, macOS universal2, windows), built by
  `maturin-action`.
- **Maven**: see SCALA.md; native libraries per platform inside the jar.
- **Release**: three ecosystems, three registries, three signing setups, all
  versioned from one crate. release-please can drive the version, but the
  publish jobs are new.
- **Toolchains**: contributors to the core need Rust; contributors to the TS
  packages keep working as today as long as the TS packages do not depend on
  the native addon.

## Go / no-go per phase

| Phase | Recommendation |
|-------|----------------|
| 1. Language-neutral IR + shared fixtures | **Go.** Cheap, already useful as a regression net for the TS packages, and a prerequisite for any port or binding. Next: move `toIR`/`fromIR` into `@rapiq/core` and extend fixtures to sorts, fields, pagination, relations and the simple and mongo dialects. |
| 2. Rust kernel (parsers, codec, memory evaluator, SQL rendering) | **Conditional.** Go only with a committed Python or JVM consumer. Do not route the TS packages through it: no speed gain, real distribution cost. |
| 3. Validate hooks and typed builders in each host language | **Go as a design rule** if phase 2 happens: hooks run in the host against the parsed IR, avoiding async callbacks across FFI. |
| 4. ORM adapters | **Stay native per ecosystem.** TypeORM/Prisma/Drizzle remain TS on top of the IR; SQLAlchemy/Django or Slick/Doobie adapters would be new code consuming the IR. |
| Alternative to phase 2 | A native port per language held to the phase 1 fixtures. For a logic-heavy, not performance-bound library this is a legitimate choice; the fixtures make drift visible. |

## Not covered by the spike

Schema and registry resolution, validate hooks, issue traces, the simple and
mongo dialects, codec-url, adapter-sql, grouped mode, a WASM build, and
publishing.

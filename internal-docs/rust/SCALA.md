# Scala binding: design note

No code in this spike, by scope. This note compares the ways a Scala
application can consume `rapiq-core` and recommends one.

## What has to cross the boundary

Exactly what the Node and Python bindings already move: the functions in
`packages/core/rust/src/api.rs`, JSON strings in and out, plus one opaque handle (a
compiled `Predicate`). That narrow surface is what makes every option below
tractable. Hand-written Scala types for the IR (a sealed `Condition` ADT with
a JSON codec) live on the Scala side, the same way `index.d.ts` and the
Python wrapper do for their languages.

## Options

| Option | How | For | Against |
|--------|-----|-----|---------|
| **Java FFM (Panama)** | `rapiq-core` gains a small `extern "C"` layer (`rapiq_parse(const char*, char**) -> i32`, `rapiq_free(char*)`, `rapiq_predicate_new/test/free`); Scala calls it via `java.lang.foreign` (`Linker`, `SymbolLookup`, `Arena`) | Final in JDK 22, no C glue, no JNI header dance, explicit memory arenas fit the "string in, string out" shape; `jextract` can generate the bindings from a cbindgen header | Requires JDK 22+ at runtime (many Scala shops are on 17/21 LTS); `--enable-native-access` flag |
| **JNI via `jni-rs`** | Rust exports `Java_net_tada5hi_rapiq_Native_parse(...)` functions; a tiny Java/Scala class declares `@native` methods | Works on every JDK in use (8+), mature, well-trodden in Rust | More boilerplate per function, JNI local-reference rules, the class/method names are baked into the symbol names |
| **UniFFI (Kotlin output)** | Annotate the API with UniFFI, generate Kotlin bindings, call them from Scala | Generated code, same tooling could also emit Swift/Python | Kotlin stdlib dependency, JNA at runtime (slow per call), Scala is a second-class consumer of Kotlin-shaped APIs |
| **Scala Native** | Link the C ABI layer directly (`@extern` objects) | Zero runtime overhead | Only for Scala Native users, a small minority |
| **Scala.js** | Consume a WASM build (or simply the TS packages) | Free if the browser/WASM target exists anyway | Not a JVM solution |
| **No FFI: native port** | Port the semantics to Scala and hold it to the shared fixtures | No native artifacts at all, idiomatic | A second implementation to maintain; the fixtures make drift detectable, not impossible |

## Recommendation

1. Add a C ABI layer to `rapiq-core` (an `ffi.rs` behind a `c-abi` feature,
   cbindgen header), since FFM, JNI wrappers, Scala Native and any future
   language (Go, C#, Ruby) can all sit on it.
2. Ship the JVM binding on **JNI** first: it is the only option that reaches
   the JDK versions Scala teams actually run today. Keep the Scala API a thin
   wrapper (`Rapiq.parseExpressionFilters(String): Condition`,
   `Predicate#test(json: String)`), mirroring the Python package.
3. Revisit **FFM** once JDK 22+ is a reasonable floor; with the C ABI in place
   the switch is a wrapper rewrite, not a core change.

## Packaging

A JVM artifact must carry one native library per OS and architecture
(`linux-x86_64`, `linux-aarch64`, `osx-aarch64`, `osx-x86_64`,
`windows-x86_64`), extracted to a temp directory and loaded with
`System.load` at first use (the approach of `sqlite-jdbc`, `netty-tcnative`,
`zstd-jni`). Either one fat jar (simple, about 5 x 1 to 2 MB) or one classifier
jar per platform (smaller, but sbt users must pick the classifier). Publishing
goes to Maven Central under a reverse-DNS group id, which needs its own
signing and namespace verification, separate from npm and PyPI.

## Open questions

- Is there an actual Scala consumer? Without one, every item above is cost
  without a user.
- Which Scala query layer would the adapter target (Slick, Doobie, Quill,
  jOOQ)? The binding only covers parse and in-memory evaluation; the ORM
  adapter is new Scala code regardless.

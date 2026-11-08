# Error and issue contracts

`packages/core/src/errors/base.ts` extends `@ebec/core`'s `BaseError`, preserving its stack, cause and `@instanceof` brand chain. Both the string and options constructors default to rapiq's `ErrorCode.NONE`. Rapiq adds a readonly enumerable `issues` property. It does not populate the error-group `errors` channel for client-input violations.

Use the guards in `packages/core/src/errors/check.ts` across package copies and JSON boundaries. They recognize the brand chain; `instanceof` against one installed class does not establish cross-copy identity. Catch only branded parse errors when merging client-input failures. Unexpected exceptions propagate.

## Collection and policy

The issue collector in `packages/core/src/parser/issue/` is owned by the parse driver. A caller-supplied collector must not bypass the policy that decides whether rejected input raises an error. The driver that opens the trace finishes it, including structural aborts.

Issue shapes come from `@ebec/core`: leaf items and nested groups. Rapiq's `buildIssue()` records its error code and absolute path, normalizes the owning parameter into `meta.parameter`, and retains a raw client key in `meta.key` when needed. Live `received` values support diagnosis. The trace budget is expressed in flattened leaves while retaining group shape.

A dropping policy records no rejection trace for the caller. A throwing parse raises one aggregate failure at the end, exposing every recorded rejection through `issues`. A parameter parse uses that parameter's error class; a query parse uses the general `ParseError`, because failures can span parameters. `ParseError.inputRejected()` uses `ErrorCode.INPUT_REJECTED`, not the first leaf's code.

Relation pruning runs before index policies inspect the executable tree. A parameter's prior failure skips only its own index policy, allowing independent parameter failures to remain visible. Structural failures that cannot use a collecting scope carry their issue on the thrown error for the driver to merge.

## Serialization and assertions

`BaseError.toJSON()` preserves the base serialization and recursively copies its issues while removing `expected` and `received` from leaf items. In-memory diagnostic data remains available on the live error. Preserve that redaction when adding issue fields or groups.

Because `issues` is enumerable, deep equality and `toThrow(errorInstance)` compare the trace as well as the error kind. Assert the guard/class, code and relevant issue contents instead of accidentally requiring an empty or identical trace.

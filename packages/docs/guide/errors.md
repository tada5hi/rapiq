# Error Handling

Every error rapiq throws extends `BaseError` and carries a machine-readable `code` from `ErrorCode`: no raw `Error`s, no string matching. This page maps the hierarchy, the codes, and how to translate them into HTTP responses.

## The hierarchy

```txt
BaseError { code: ErrorCode }
├── BuildError            defineQuery / helpers: malformed build input
├── MergeError            mergeQueries / node merge: discarded field gates
├── ParseError            parsers & decoders: invalid client input
│   ├── FieldsParseError
│   ├── FiltersParseError
│   ├── PaginationParseError
│   ├── RelationsParseError
│   └── SortParseError
├── AdapterError          backends & encoders: query exceeds the target's subset
├── CodecError            codec registry: unresolvable dialect
└── SchemaError           schema registry: misconfigured or unresolvable schema
    ├── SchemaEntityMismatchError        @rapiq/adapter-typeorm: schema keys unknown to the entity
    └── SchemaEntityIndexMismatchError   @rapiq/adapter-typeorm: declared indexes the entity lacks
```

## Where errors come from

### Build time (caller bug)

`defineQuery` and the condition helpers throw `BuildError` on malformed input: an unknown `$` operator, an invalid key, a bad value shape. These indicate a programming error, not bad user input:

| Code | Trigger |
|---|---|
| `INPUT_INVALID` | input that isn't a valid build shape |
| `KEY_INVALID` | syntactically invalid field key |
| `KEY_VALUE_INVALID` | value shape doesn't fit the operator |
| `KEY_UNKNOWN` | unrecognized top-level `defineQuery` input key |
| `KEY_AMBIGUOUS` | both `sorts` and its deprecated alias `sort` supplied together |
| `OPERATOR_UNSUPPORTED` | unknown `$` operator key |

### Merge time (caller bug)

`MergeError` with `FIELDS_CONDITION_DISCARDED`: a fields merge collision would drop a [row-scoped visibility gate](/guide/fields#row-scoped-fields). Keep the gated query as the receiver instead of merging it underneath an ungated one.

Filters have no such code: [`merge()`](/guide/merging-queries#filters-monotonic-conjunction) is total. It composes every predicate with ordered logical AND, so composition narrows instead of failing.

### Parse time (client input)

Most parser parameters throw subclasses of `ParseError` when `throwOnFailure` is enabled and otherwise drop disallowed input. Expression filters are stricter: schema-key violations always throw because an expression cannot be partially reinterpreted safely. See [drop vs. throw](/guide/schemas#failure-behavior-drop-vs-throw).

| Code | Trigger |
|---|---|
| `KEY_NOT_ALLOWED` | key outside the schema's allow-list |
| `KEY_PATH_NOT_ALLOWED` | relation path rejected by an allow-list or the relations context |
| `KEY_VALIDATE_REJECTED` | key rejected by a schema [`validate` hook](/guide/schemas#validate-hooks-parse-context) |
| `KEY_COMBINATION_NOT_INDEXED` | `filters` or `sorts` combination an [`indexed` schema](/guide/schemas#indexes)'s declared indexes cannot serve |
| `KEY_INVALID` | syntactically invalid key under an open schema |
| `KEY_PATH_INVALID` | unresolvable relation path |
| `KEY_VALUE_INVALID` | malformed value for an operator |
| `KEY_AMBIGUOUS` | both `sorts` and its deprecated alias `sort` supplied at once |
| `LIMIT_EXCEEDED` | `page[limit]` above the schema's `maxLimit` |
| `OPERATOR_UNSUPPORTED` | a recognized dialect operator with no AST counterpart (MongoDB-style parser: known operators like `$type` / `$where` / `$text` / `$expr`, or `$not` over a bare `$regex`); a grammar error that throws regardless of the drop policy |
| `SYNTAX_INVALID` | malformed expression / document grammar |
| `INPUT_INVALID` | non-object top-level input |

Two dialects are stricter than the drop policy for grammar: **grammar errors always throw**, regardless of schema settings. A malformed expression string ([expression parser](/packages/parser-expression)) or a broken `$`-operator document ([MongoDB-style parser](/packages/parser-mongo)) has no silent-drop reading.

`KEY_AMBIGUOUS` is unconditional too, on every surface (`defineQuery`, `defineSchema`, and every parser/codec `parse()`/`decode()`): supplying both `sorts` and its deprecated alias `sort` throws regardless of `throwOnFailure`, since the two spellings name one parameter and picking a winner would silently drop the other. This is a narrower guarantee than [unknown keys are rejected](/guide/building-queries): parsers still ignore an unrelated key they don't recognize; only `defineQuery` and `defineSchema` reject those.

### Encode/apply time (query exceeds the target)

`AdapterError`: the query is valid, but the target can't express it:

| Code | Trigger |
|---|---|
| `OPERATOR_UNSUPPORTED` | e.g. `regex` on a dialect without regex support; `regex`/`mod`/`exists`/`elemMatch` on a URL wire |
| `FEATURE_UNSUPPORTED` | e.g. `or(...)` over the simple URL dialect; values that wouldn't survive the wire round trip; a query whose `Field` carries a [validate-hook condition](/guide/schemas#condition-verdicts) |
| `CONDITION_DETACHED` | a condition the built-in consumer cannot lower: either a live custom `ICondition` that needs a compatible custom adapter/visitor, or detached runtime data from a JSON/RPC/cache round trip. Rebuild detached data with the condition helpers; dropping either would silently widen the result set |

The URL encoders throw these too; a codec never silently changes what a query means. See [What fits on the wire](/guide/wire#what-fits-on-the-wire).

### Codec dispatch

`CodecError` with `CODEC_UNRESOLVABLE`: a payload named a codec that isn't registered. See [@rapiq/codec-url](/packages/codec-url).

### Schema registry (server bug)

`SchemaError`: the `SchemaRegistry` was misused or misconfigured. Like `BuildError`, these indicate a programming error on the receiving side:

| Code | Trigger |
|---|---|
| `SCHEMA_NAME_INVALID` | `registry.add()` with a schema that has no `name` |
| `SCHEMA_UNRESOLVABLE` | `registry.getOrFail()` for a name that isn't registered |
| `KEY_UNKNOWN` | `defineSchema()` with a top-level option key it doesn't recognize |
| `KEY_AMBIGUOUS` | `defineSchema()` with both `sorts` and its deprecated alias `sort` |
| `SCHEMA_KEY_VALIDATOR_CONFLICT` | a `fields`/`relations`/`sorts` sub-schema declares both [`validate` and `validateMany`](/guide/schemas#batched-validation-with-validatemany); thrown while the schema is constructed, since there is no sensible precedence between them |
| `SCHEMA_PRESERVED_CONDITION_PRUNED` | the [relations gate](/guide/relations#validate-hooks) rejected a relation that a [`preserve()`](/guide/merging-queries#preservation-is-for-relation-pruning) filter condition needs; the two validators contradict each other, see [scoping a filterable field](/guide/recipes/authorization#scoping-server-conditions) |
| `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER` | `parse()` (or a synchronous codec method) encountered an async validator (a filter validator or a key validation hook); use the corresponding `Async` method |
| `SCHEMA_ENTITY_MISMATCH` | `assertSchemaMatchesEntity` (`@rapiq/adapter-typeorm`) found schema keys unknown to the entity; thrown as `SchemaEntityMismatchError`, which carries the offending `schema`, `entity` and `keys`; see [validating schemas against entities](/packages/adapter-typeorm#validating-schemas-against-entities) |
| `SCHEMA_ENTITY_INDEX_MISMATCH` | `assertSchemaMatchesEntity` (`@rapiq/adapter-typeorm`) found an [`indexes`](/guide/schemas#indexes) sequence that leads no primary key, unique constraint or index of the entity; thrown as `SchemaEntityIndexMismatchError`, which carries `schema`, `entity` and the offending `indexes`; see [declared indexes](/packages/adapter-typeorm#declared-indexes) |

## Mapping to HTTP responses

A pragmatic mapping for a typical endpoint:

```typescript
import { ParseError } from '@rapiq/core';

app.get('/users', async (req, res) => {
    let query;
    try {
        query = codec.decode(req.query, { schema: 'user' });
    } catch (e) {
        if (e instanceof ParseError) {
            // client sent something outside the contract
            return res.status(400).json({ error: e.message, code: e.code });
        }
        throw e; // everything else is a server bug
    }

    if (!query) {
        return res.status(400).end(); // non-object input
    }
    // ...
});
```

- `ParseError` (with `throwOnFailure`) → **400**: the client broke the contract; `e.message` names the offending key.
- `BuildError` / `MergeError` / `AdapterError` / `SchemaError` on the server → **500**: these mean *your* code produced or forwarded something invalid.
- `AdapterError` on the caller (encode) → fix the query or switch wire dialect; it never leaves the caller.

## Adding failure modes of your own

When extending rapiq (custom parsers, adapters), follow the same pattern: add an `ErrorCode` member and a static factory on the matching error class rather than throwing raw `Error`s.

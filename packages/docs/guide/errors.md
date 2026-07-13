# Error Handling

Every error rapiq throws extends `BaseError` and carries a machine-readable `code` from `ErrorCode` — no raw `Error`s, no string matching. This page maps the hierarchy, the codes, and how to translate them into HTTP responses.

## The hierarchy

```txt
BaseError { code: ErrorCode }
├── BuildError            defineQuery / helpers — malformed build input
├── MergeError            mergeQueries / Filters.merge — non-flat trees
├── ParseError            parsers & decoders — invalid client input
│   ├── FieldsParseError
│   ├── FiltersParseError
│   ├── PaginationParseError
│   ├── RelationsParseError
│   └── SortParseError
├── AdapterError          backends & encoders — query exceeds the target's subset
└── CodecError            codec registry — unresolvable dialect
```

## Where errors come from

### Build time (caller bug)

`defineQuery` and the condition helpers throw `BuildError` on malformed input — an unknown `$` operator, an invalid key, a bad value shape. These indicate a programming error, not bad user input:

| Code | Trigger |
|---|---|
| `INPUT_INVALID` | input that isn't a valid build shape |
| `KEY_INVALID` | syntactically invalid field key |
| `KEY_VALUE_INVALID` | value shape doesn't fit the operator |
| `OPERATOR_UNSUPPORTED` | unknown `$` operator key |

### Merge time (caller bug)

`MergeError` with `FILTERS_NOT_FLAT` — a replace-merge met a compound filter tree. See [Merging & Composition](/guide/merging-queries#merge--per-field-replace).

### Parse time (client input)

Parsers throw subclasses of `ParseError` — but **only when `throwOnFailure` is enabled**; the default policy silently drops disallowed input. See [drop vs. throw](/guide/schemas#failure-behavior-drop-vs-throw).

| Code | Trigger |
|---|---|
| `KEY_NOT_ALLOWED` | key outside the schema's allow-list |
| `KEY_PATH_NOT_ALLOWED` | relation path rejected by an allow-list or the relations context |
| `KEY_INVALID` | syntactically invalid key under an open schema |
| `KEY_PATH_INVALID` | unresolvable relation path |
| `KEY_VALUE_INVALID` | malformed value for an operator |
| `SYNTAX_INVALID` | malformed expression / document grammar |
| `INPUT_INVALID` | non-object top-level input |

Two dialects are stricter than the drop policy: **grammar errors always throw**, regardless of schema settings — a malformed expression string ([expression parser](/packages/parser-expression)) or a broken `$`-operator document ([MongoDB-style parser](/packages/parser-mongo)) has no silent-drop reading.

### Encode/apply time (query exceeds the target)

`AdapterError` — the query is valid, but the target can't express it:

| Code | Trigger |
|---|---|
| `OPERATOR_UNSUPPORTED` | e.g. `regex` on a dialect without regex support; `regex`/`mod`/`exists`/`elemMatch` on a URL wire |
| `FEATURE_UNSUPPORTED` | e.g. `or(...)` over the simple URL dialect; values that wouldn't survive the wire round trip |

The URL encoders throw these too — a codec never silently changes what a query means. See [What fits on the wire](/guide/wire#what-fits-on-the-wire).

### Codec dispatch

`CodecError` with `CODEC_UNRESOLVABLE` — a payload named a codec that isn't registered. See [@rapiq/codec-url](/packages/codec-url).

## Mapping to HTTP responses

A pragmatic mapping for a typical endpoint:

```typescript
import { ParseError } from '@rapiq/core';

app.get('/users', async (req, res) => {
    let query;
    try {
        query = decoder.decode(req.query, { schema: 'user' });
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

- `ParseError` (with `throwOnFailure`) → **400** — the client broke the contract; `e.message` names the offending key.
- `BuildError` / `MergeError` / `AdapterError` on the server → **500** — these mean *your* code produced or forwarded something invalid.
- `AdapterError` on the caller (encode) → fix the query or switch wire dialect; it never leaves the caller.

## Adding failure modes of your own

When extending rapiq (custom parsers, adapters), follow the same pattern: add an `ErrorCode` member and a static factory on the matching error class rather than throwing raw `Error`s.

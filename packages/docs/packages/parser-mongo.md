# @rapiq/parser-mongo

Parses MongoDB-style filter documents — useful when filters travel as structured JSON (request bodies, stored filters) or the calling application already speaks the [MongoDB query language](https://www.mongodb.com/docs/manual/reference/operator/query/). The dialect is input syntax only: the result is the same [`Query`](/guide/query-ast) every backend consumes — the receiving application does **not** need to run MongoDB.

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-mongo
```

## The dialect

Filters are plain objects with typed values — numbers stay numbers, there is no wire-string coercion (`Date` instances pass through into the AST as-is; ISO strings are **not** coerced to dates):

```typescript
{ name: 'John' }                                    // bare scalar → $eq
{ status: ['active', 'pending'] }                   // bare array → $in
{ name: /^jo/i }                                    // bare RegExp → $regex
{ age: { $gte: 18, $lt: 65 } }                      // operator object (implicit AND)
{ $or: [{ name: 'John' }, { age: { $lt: 18 } }] }   // compound
{ 'realm.name': 'master' }                          // dotted relation path
{ items: { $elemMatch: { id: { $gt: 5 } } } }       // array-element match
{ scores: { $elemMatch: { $gt: 5 } } }              // element-level match (the element itself)
{ tags: { $all: ['a', 'b'] } }                      // every listed value has a matching element
{ tags: { $size: 2 } }                              // array-length match
```

Multiple document entries combine with an implicit AND. `$and` / `$or` / `$nor` take a non-empty array of sub-documents; `$nor` and `$not` desugar via De Morgan operator negation (`$eq` ↔ `$ne`, `$lt` ↔ `$gte`, AND ↔ OR, …).

| Operator | AST operator | Negated (`$not` / `$nor`) | Value |
|---|---|---|---|
| `$eq` | `EQUAL` | `NOT_EQUAL` | scalar, `null` or `Date` |
| `$ne` | `NOT_EQUAL` | `EQUAL` | scalar, `null` or `Date` |
| `$lt` / `$lte` / `$gt` / `$gte` | `LESS_THAN`, … | flipped bound (`$lt` ↔ `$gte`, `$lte` ↔ `$gt`) | string, number or `Date` |
| `$in` | `IN` | `NOT_IN` | non-empty array of scalar/`null`/`Date` |
| `$nin` | `NOT_IN` | `IN` | non-empty array of scalar/`null`/`Date` |
| `$startsWith` † | `STARTS_WITH` | `NOT_STARTS_WITH` | string |
| `$notStartsWith` † | `NOT_STARTS_WITH` | `STARTS_WITH` | string |
| `$endsWith` † | `ENDS_WITH` | `NOT_ENDS_WITH` | string |
| `$notEndsWith` † | `NOT_ENDS_WITH` | `ENDS_WITH` | string |
| `$contains` † | `CONTAINS` | `NOT_CONTAINS` | string |
| `$notContains` † | `NOT_CONTAINS` | `CONTAINS` | string |
| `$regex` | `REGEX` | — (throws) | `RegExp` instance or pattern string |
| `$options` | — (modifier) | — | flag string; only beside a string-valued `$regex` |
| `$mod` | `MOD` | — (throws) | `[divisor, remainder]`, divisor ≠ 0 |
| `$size` | `SIZE` | — (throws) | non-negative integer (array length) |
| `$exists` | `EXISTS` | boolean flag flipped | boolean |
| `$elemMatch` | `ELEM_MATCH` | — (throws) | nested filter document (fields relative to the array element) or element-level operator object (operators apply to the element itself, via the `ITSELF` marker) |
| `$all` | AND of `ELEM_MATCH` | — (throws) | non-empty array of scalar/`null`/`Date`; desugars to one independently scoped element match per value |
| `$not` | negation | — (no nesting) | object of field-level operators |

† **rapiq extension — not valid MongoDB.** These cover the substring matches MongoDB only reaches through `$regex`, mapping 1:1 to the AST operators every rapiq dialect shares.

::: warning Deviations from MongoDB
- Nested plain objects expand to dotted key paths — `{ realm: { name: 'x' } }` ≡ `{ 'realm.name': 'x' }` — instead of MongoDB's exact-embedded-document match.
- A bare array value means `$in` instead of MongoDB's exact-array match.
- Negation is algebraic (De Morgan operator flipping) — it does not replicate MongoDB's missing-field semantics, where `$not` also matches documents lacking the field.
- `$all` never falls back to plain equality on non-array fields — MongoDB's `{ tags: { $all: ['a'] } }` matches `tags: 'a'`, the rapiq desugar does not (element matches require a real array).
- `$where`, `$type` and the other evaluation/geo/bitwise operators are unsupported and throw.
- MongoDB's `x` regex flag has no JavaScript equivalent — `$options: 'x'` is rejected.
- An empty sub-document `{}` inside a compound (MongoDB's match-all branch) is a grammar error.
:::

::: warning Untrusted `$regex`
`$regex` patterns pass through the parser verbatim — this is the only dialect that lets a client submit one. If filter documents come from untrusted clients and are evaluated in-process with [`@rapiq/memory`](/packages/memory), gate the operator with the schema's `filters.validate` hook — see the [regex trust model](/guide/filters#regex-trust-model).
:::

## Usage

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { MongoParser } from '@rapiq/parser-mongo';

const registry = new SchemaRegistry();
registry.add(defineSchema<User>({
    name: 'user',
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'] },
}));

const parser = new MongoParser(registry);

const query = parser.parse({
    filters: {
        $or: [
            { name: { $contains: 'jo' } },
            { age: { $gte: 18, $lt: 65 } },
        ],
    },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the mongo dialect — fields, relations, pagination and sort accept the same input as the [simple parser](/packages/parser-simple), and the whole thing returns the same [`Query`](/guide/query-ast).

There is also a standalone `MongoFiltersParser` returning just the `Filters` node; its `parseTyped(input, options)` accepts a `MongoFiltersParserInput<RECORD>`, so field keys and operator values are type-checked against the record type. For schemas with asynchronous filter validators, use `parseAsync()` or `parseTypedAsync()`.

## Failure model

Failures fall into two classes:

- **Grammar errors always throw** `FiltersParseError`, independent of the schema failure policy — unknown or misplaced `$`-operators, malformed operator values, invalid compound arrays, mixed operator and plain keys, non-object top-level input, documents nested deeper than 32 levels. A `$`-prefixed key is never a field name, so there is no silent-drop reading for a broken document; map these to a `400` response.
- **Field-key / allow-list failures follow the schema policy** — dropped silently by default, thrown when `throwOnFailure` is set. A dropped field drops its whole entry, an `$elemMatch` subtree included.

Absent input, `{}` and an all-dropped document are not failures — the schema's `filters.default` applies, like with the other parsers.

Error codes: malformed documents carry `ErrorCode.SYNTAX_INVALID`, invalid operator values `KEY_VALUE_INVALID`, non-object top-level input `INPUT_INVALID`, known-but-unsupported MongoDB operators (`$where`, `$type`, …) and non-negatable operators under `$not`/`$nor` (`$regex`, `$mod`, `$size`, `$elemMatch`, `$all`) `OPERATOR_UNSUPPORTED`. See [Error Handling](/guide/errors).

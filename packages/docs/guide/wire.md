# Queries over the Wire

A `Query` crosses process boundaries through a **codec**: the encoder turns the AST into a URL query string, the decoder turns incoming wire input back into the AST — validated against a [schema](/guide/schemas) on the way in. This page covers the flow; the exact wire grammars live on the [codec package pages](/packages/codec-url-simple).

## Encoding (caller)

```typescript
import { URLEncoder } from '@rapiq/codec-url-simple';

const queryString = new URLEncoder().encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&include=realm&sort=-age

await fetch(`/users?${queryString}`);
```

The wire uses the JSON:API-style parameter names:

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | `filter[age]=>=18` |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

## Decoding (receiver)

`URLDecoder` accepts a raw query string *or* an already-parsed object like express' `req.query`, maps the wire names to the canonical parameters, and validates against your schema:

```typescript
import { URLDecoder } from '@rapiq/codec-url-simple';

const decoder = new URLDecoder(registry);

// from a raw query string ...
const query = decoder.decode('filter[age]=>=18&sort=-age', { schema: 'user' });

// ... or straight from express
app.get('/users', (req, res) => {
    const query = decoder.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end(); // null for non-object input
    }
});
```

::: tip Input that isn't URL-shaped
If your input already uses the canonical parameter keys (`filters`, `pagination`, …) — say, a JSON request body — skip the codec and use a [parser](/packages/parser-simple) directly: `new SimpleParser(registry).parse(input, { schema: 'user' })`. MongoDB-style filter documents have their [own parser](/packages/parser-mongo).
:::

## What fits on the wire

Every wire dialect expresses only a **subset** of the query AST. Inside its subset, a codec guarantees the round trip: `decode(encode(query))` gives the query back (up to scalar normalization — the wire is untyped, so `'5'` returns as `5`, `'true'` as `true`).

Outside its subset, `encode` **throws a typed error instead of silently changing what the query means.** This is a deliberate design decision: a query that encodes is a query that arrives intact.

Two URL dialects ship, with different subsets:

| | [simple](/packages/codec-url-simple) | [expression](/packages/codec-url-expression) |
|---|---|---|
| Wire shape | `filter[age]=>=18` per field | one `filter=and(gte(age,'18'),…)` expression |
| Flat AND filters | ✓ | ✓ |
| `or(...)`, nested groups | ✗ throws | ✓ |
| Several conditions on one field | ✗ throws | ✓ |
| Values containing commas / operator markers | ✗ throws | ✓ (quoted) |
| `regex` / `mod` / `exists` / `elemMatch` | ✗ throws | ✗ throws |
| Human-writable by hand | very | somewhat |

Rule of thumb: start with the simple dialect — it is what plain clients and hand-written URLs speak. Reach for the expression dialect when compound filter trees must cross the URL. The operators no URL dialect carries still work everywhere *behind* the wire: in-process queries hand the AST to an [adapter](/guide/executing-queries) directly.

## Schema-aware encoding

Encoders optionally validate against the same schema the receiver will use — early feedback on the caller, identical semantics by construction:

```typescript
const encoder = new URLEncoder(registry);
encoder.encode(query, { schema: 'user' });
```

Disallowed keys are dropped (or throw, with `throwOnFailure`), aliases resolve to canonical names, `maxLimit` clamps the emitted limit — and parameters absent from the query stay absent, so schema defaults are not materialized onto the wire.

## Accepting multiple dialects

When one endpoint must accept both dialects, [`@rapiq/codec-url`](/packages/codec-url) makes payloads self-describing: encoding through its registry stamps a reserved `codec` parameter, decoding dispatches on it. Unstamped payloads fall back to the default (simple) — plain clients keep working.

```typescript
import { createURLCodecRegistry } from '@rapiq/codec-url';

const codecs = createURLCodecRegistry(schemaRegistry);

codecs.encode(query, { codec: 'url-expression' });
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

codecs.decode(req.query, { schema: 'user' }); // dispatches on the stamp
```

## Next steps

- [Executing Queries](/guide/executing-queries) — what the receiver does with the decoded query.
- [@rapiq/codec-url-simple](/packages/codec-url-simple) — full wire grammar & round-trip rules.
- [@rapiq/codec-url-expression](/packages/codec-url-expression) — the expression wire format.

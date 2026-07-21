# Queries over the Wire

A `Query` crosses process boundaries through `@rapiq/codec-url`: the façade encodes the AST as a self-described URL query string and decodes incoming wire input back into the AST, validating against a [schema](/guide/schemas) along the way.

## Encoding (caller)

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec();
const queryString = codec.encode(query);
// codec=url-expression&fields=id,name&filter=gte(age%2C'18')&page[limit]=25&...

await fetch(`/users?${queryString}`);
```

New payloads use the expression filter dialect and carry `codec=url-expression`. Pass `{ stamp: false }` to omit the reserved stamp for receivers outside rapiq (e.g. strict JSON:API endpoints) — untagged output is still recognized structurally on decode. The remaining URL parameters use JSON:API-style names:

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | `filter=and(gte(age,'18'),eq(active,'true'))` |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

## Decoding (receiver)

The same façade accepts a raw query string or an already-parsed object such as Express' `req.query`:

```typescript
const codec = createURLCodec(registry);

const query = codec.decode(
    "codec=url-expression&filter=gte(age,'18')&sort=-age",
    { schema: 'user' },
);

app.get('/users', (req, res) => {
    const query = codec.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end();
    }
});
```

::: tip Input that isn't URL-shaped
If your input already uses canonical parameter keys (`filters`, `pagination`, …), use a [parser](/packages/parser-simple) directly. MongoDB-style filter documents have their [own parser](/packages/parser-mongo).
:::

### Decoding a subset of parameters

Sometimes only part of a query should apply — a bulk delete, for example, must honor the request's filters but never its pagination. Pass `parameters` to decode only the listed parameters; everything else stays empty and, importantly, schema defaults such as `pagination.maxLimit` do **not** materialize for masked parameters:

```typescript
app.delete('/sessions', (req, res) => {
    const query = codec.decode(req.query, {
        schema: 'session',
        parameters: ['filters'],
    });
    // query.pagination is empty — the schema's maxLimit cannot
    // silently truncate the delete's row selection.
});
```

## Migration dispatch

The v2 codec follows a read-both/write-expression migration:

1. A stamped payload dispatches to its named dialect.
2. An unstamped non-empty string `filter` is parsed as an expression.
3. Any other unstamped defined `filter` — bracket/object input, or an empty `filter=` — is parsed as legacy simple input.
4. An unknown stamped codec throws `CodecError` with `CODEC_UNRESOLVABLE`.

This lets receiving applications upgrade before callers. Existing URLs such as `filter[age]=>=18` continue to decode, while upgraded callers begin producing expressions.

Simple encoding is available temporarily and explicitly:

```typescript
import { URL_SIMPLE_CODEC } from '@rapiq/codec-url';

codec.encode(query, { codec: URL_SIMPLE_CODEC });
// codec=url-simple&filter[age]=>=18
```

`URL_SIMPLE_CODEC` and simple encoding are deprecated for removal in v3.

## What fits on the wire

Every wire dialect expresses a subset of the query AST. Inside that subset, `decode(encode(query))` restores the same query up to scalar normalization (`'5'` returns as `5`). Outside it, encoding throws a typed error instead of changing the query's meaning.

| | [legacy simple](/packages/codec-url#legacy-simple-dialect) | [expression](/packages/codec-url#expression-dialect) |
|---|---|---|
| Wire shape | `filter[age]=>=18` per field | one `filter=and(gte(age,'18'),…)` expression |
| Flat AND filters | ✓ | ✓ |
| `or(...)`, `not(...)`, nested groups | ✗ throws | ✓ |
| Several conditions on one field | ✗ throws | ✓ |
| Commas / simple operator markers in values | ✗ throws | ✓ (quoted) |
| `elemMatch` (incl. the `ITSELF` element marker, wire spelling `$this`) | ✗ throws | ✓ |
| `regex` / `mod` / `exists` | ✗ throws | ✗ throws |

## Schema-aware transport

Use the same registry on both sides and select the schema per operation:

```typescript
const codec = createURLCodec(registry);

const wire = codec.encode(query, { schema: 'user' });
const decoded = codec.decode(wire!, { schema: 'user' });
```

Disallowed keys are dropped or thrown according to the schema, aliases resolve, pagination limits clamp, and filter validators run with parser-exact semantics. Parameters absent from the source query remain absent from the wire.

When validators are asynchronous, use `await codec.encodeAsync(...)` and `await codec.decodeAsync(...)`.

## Next steps

- [Executing Queries](/guide/executing-queries) — what the receiver does with the decoded query.
- [@rapiq/codec-url](/packages/codec-url) — complete dialect, migration and extension reference.

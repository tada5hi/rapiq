# @rapiq/codec-url-simple

Moves a [`Query`](/guide/query-ast) over the wire in the **simple dialect**: `URLEncoder` turns the AST into a JSON:API-style URL query string, `URLDecoder` turns a query string (or an express-style `req.query` object) back into the AST. The narrative introduction lives at [Queries over the Wire](/guide/wire).

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/codec-url-simple
```

## Parameter names

The codec owns the wire naming — parsers never see it:

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | `filter[age]=>=18` |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

## Encoding

```typescript
import { URLEncoder } from '@rapiq/codec-url-simple';

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&include=realm&sort=-age
```

Filter values use the same operator prefixes the [simple wire dialect](/guide/filters#on-the-wire-simple-dialect) parses. Per-parameter encoders exist too: `encodeFields`, `encodeFilters`, `encodePagination`, `encodeRelations`, `encodeSort`.

### The round-trip guarantee

Every dialect expresses only a **subset** of the query AST. Within that subset the codec guarantees `decode(encode(query)) ≍ query` — equal up to *scalar type normalization*: the wire is untyped, so `'5'` comes back as the number `5`, `'true'` as `true`, `'null'` as `null`, and surrounding whitespace is trimmed.

Outside the subset, `encode` **throws a typed error** instead of silently changing the query's meaning:

| Outside the simple dialect | Error code |
|---|---|
| `or(...)` compounds, nested compound groups | `FEATURE_UNSUPPORTED` |
| Two conditions on the same field | `FEATURE_UNSUPPORTED` |
| `REGEX`, `MOD`, `EXISTS`, `ELEM_MATCH` operators | `OPERATOR_UNSUPPORTED` |
| Comma-containing strings (would decode as `IN`) | `FEATURE_UNSUPPORTED` |
| Empty strings / empty `IN` lists (would be dropped) | `FEATURE_UNSUPPORTED` |
| Values colliding with operator markers (`'foo~'`, `'!x'`, `'<5'`) | `FEATURE_UNSUPPORTED` |

The last row is enforced pointwise: the encoder re-parses every wire token it emits and rejects it if the operator would not survive the trip. If your filters need any of these, use the [expression codec](/packages/codec-url-expression).

### Schema-aware encoding

Pass a schema to validate the output the same way the receiving decoder would treat it — early feedback on the caller, exact parser semantics:

```typescript
import { URLEncoder } from '@rapiq/codec-url-simple';

const encoder = new URLEncoder(registry); // SchemaRegistry, like URLDecoder

encoder.encode(query, { schema: 'user' });
```

- Disallowed fields/filters/relations/sort keys are **dropped** by default; a schema with `throwOnFailure: true` throws instead.
- Schema `mapping` aliases resolve to their canonical names on the wire.
- `pagination.maxLimit` clamps the emitted limit.
- Parameters absent from the input query stay absent — schema defaults are *not* materialized onto the wire (the receiver applies them on decode anyway).
- `strict` mode is honored, mirroring the parsers.

## Decoding

```typescript
import { URLDecoder } from '@rapiq/codec-url-simple';

const decoder = new URLDecoder(registry);

// from a raw query string ...
const query = decoder.decode('filter[age]=>=18&sort=-age&page[limit]=25', { schema: 'user' });

// ... or from an already parsed query object (express req.query)
app.get('/users', (req, res) => {
    const query = decoder.decode(req.query, { schema: 'user' });
    // ...
});
```

`decode(input, options?)` accepts a raw query string (parsed via [qs](https://www.npmjs.com/package/qs)) or a pre-parsed query object. It maps the wire names to the canonical parameters and delegates to a schema-aware [`SimpleParser`](/packages/parser-simple). It returns a `Query`, or `null` for non-object input.

Per-parameter variants exist as well: `decodeFields`, `decodeFilters`, `decodePagination`, `decodeRelations`, `decodeSort` — each also accepting `{ schema }` options.

## Related

- [@rapiq/codec-url-expression](/packages/codec-url-expression) — wider filter subset (nested compounds) on the same wire machinery.
- [@rapiq/codec-url](/packages/codec-url) — dispatch between both dialects on one endpoint.

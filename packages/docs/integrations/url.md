# URL Codec

`@rapiq/codec-url-simple` moves a [`Query`](/guide/query) over the wire: `URLEncoder` turns the AST into a URL query string, `URLDecoder` turns a query string back into the AST.

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/codec-url-simple
```

## Encoding

```typescript
import { URLEncoder } from '@rapiq/codec-url-simple';

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&include=realm&sort=-age
```

The output uses the JSON:API-style parameter names (`fields`, `filter`, `page`, `include`, `sort`) and the same operator prefixes the [simple dialect](/guide/filters#operator-syntax) parses — encode → decode round-trips.

Per-parameter encoders exist too: `encodeFields`, `encodeFilters`, `encodePagination`, `encodeRelations`, `encodeSort`.

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

The last row is enforced pointwise: the encoder re-parses every wire token it emits and rejects it if the operator would not survive the trip. If your filters need any of these, use the [expression dialect](#expression-dialect).

### Schema-aware encoding

Pass a schema to validate the output the same way the server-side decoder would treat it — early feedback on the client, exact parser semantics:

```typescript
import { SchemaRegistry } from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

const encoder = new URLEncoder(registry); // SchemaRegistry, like URLDecoder

encoder.encode(query, { schema: 'user' });
```

- Disallowed fields/filters/relations/sort keys are **dropped** by default; a schema with `throwOnFailure: true` throws instead.
- Schema `mapping` aliases resolve to their canonical names on the wire.
- `pagination.maxLimit` clamps the emitted limit.
- Parameters absent from the input query stay absent — schema defaults are *not* materialized onto the wire (the server applies them on decode anyway).
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

`decode(input, options?)` accepts a raw query string (parsed via
[qs](https://www.npmjs.com/package/qs)) or a pre-parsed query object. It maps
the JSON:API wire names (`filter`, `page`, `include`, …) to the canonical
parameters and delegates to a schema-aware [`SimpleParser`](/integrations/simple)
— pass a `SchemaRegistry` to the constructor and a `schema` option to
validate untrusted client input. It returns a `Query`, or `null` for
non-object input.

Per-parameter variants exist as well: `decodeFields`, `decodeFilters`,
`decodePagination`, `decodeRelations`, `decodeSort` — each also accepting
`{ schema }` options.

## Parameter names

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | `filter[age]=>=18` |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

## Expression dialect

`@rapiq/codec-url-expression` carries the filters parameter as a single
[expression](/integrations/expression) — nested `and`/`or` compounds cross the
URL boundary first-class. The other four parameters share the simple codec's
wire format.

```sh
npm install @rapiq/core @rapiq/parser-expression @rapiq/codec-url-simple @rapiq/codec-url-expression
```

```typescript
import { URLDecoder, URLEncoder } from '@rapiq/codec-url-expression';
import { and, defineQuery, eq, gte, or } from '@rapiq/core';

const encoder = new URLEncoder();

const query = defineQuery({
    filters: and(eq('name', 'John'), or(gte('age', 18), eq('email', null))),
    pagination: { limit: 20 },
});

encoder.encode(query);
// filter=and(eq(name,'John'),or(gte(age,'18'),eq(email,null)))&page[limit]=20
```

Its expressible subset is wider than the simple dialect's: nested compounds,
several conditions on the same field and comma-containing strings all
round-trip (values are quoted, `''` escapes a quote). Still outside it —
and loudly rejected on encode:

| Outside the expression dialect | Error code |
|---|---|
| `REGEX`, `MOD`, `EXISTS`, `ELEM_MATCH` operators | `OPERATOR_UNSUPPORTED` |
| Match text that coerces to a non-string (`startsWith(code, '5')`) | `FEATURE_UNSUPPORTED` |
| Field segments colliding with grammar keywords (`null`, `eq`, …) | `FEATURE_UNSUPPORTED` |
| Empty nested compound groups | `FEATURE_UNSUPPORTED` |

Schema-aware encoding works exactly like the simple codec's, with one dialect
difference: the expression filters parser is *precise* — a schema violation in
filters always throws (`FiltersParseError`), it is never silently dropped.

## Codec registry

Which codec produced a payload is API-contract metadata — but a gateway that
forwards queries it did not author cannot always know it out-of-band.
`@rapiq/codec-url` makes payloads self-describing: encoding through the
registry stamps a reserved `codec` parameter, decoding dispatches on it.

```sh
npm install @rapiq/core @rapiq/codec-url-simple @rapiq/codec-url-expression @rapiq/codec-url
```

```typescript
import { createURLCodecRegistry } from '@rapiq/codec-url';

const codecs = createURLCodecRegistry(schemaRegistry);

codecs.encode(query);
// codec=url-simple&filter[name]=John

codecs.encode(query, { codec: 'url-expression' });
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

codecs.decode('codec=url-expression&filter=or(...)', { schema: 'user' });
codecs.decode('filter[name]=John'); // no stamp → default codec (simple)
```

Dispatch rules:

- An **unstamped** payload falls back to the registry default — plain clients
  and hand-written URLs keep working.
- A payload naming an **unregistered** codec throws a typed `CodecError`
  (`ErrorCode.CODEC_UNRESOLVABLE`) — it is never silently mis-decoded under
  another dialect.

`createURLCodecRegistry()` bundles the two built-in dialects with
`url-simple` as the default. Custom codecs implement the `URLCodec` shape
(`{ name, encoder, decoder }`) and register on a plain `URLCodecRegistry`;
each bundled package exports its identifier (`URL_SIMPLE_CODEC`,
`URL_EXPRESSION_CODEC`) for out-of-band negotiation (e.g. headers) as well.

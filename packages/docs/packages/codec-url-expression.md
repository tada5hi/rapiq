# @rapiq/codec-url-expression

The URL codec for the **expression dialect**: the filters parameter crosses the URL boundary as a single [expression](/packages/parser-expression) — nested `and`/`or` compounds first-class — while the other four parameters share the [simple codec](/packages/codec-url-simple)'s wire format.

```sh
npm install @rapiq/core @rapiq/parser-expression @rapiq/codec-url-simple @rapiq/codec-url-expression
```

## Usage

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

Decoding mirrors the simple codec — a raw query string or a pre-parsed `req.query` object, validated against a schema:

```typescript
const decoder = new URLDecoder(registry);
const query = decoder.decode(req.query, { schema: 'user' });
```

For schemas with asynchronous filter validators, use `encodeAsync()` / `encodeFiltersAsync()` and `decodeAsync()` / `decodeFiltersAsync()`.

## The expressible subset

Wider than the simple dialect's: nested compounds, several conditions on the same field and comma-containing strings all round-trip (values are quoted, `''` escapes a quote). Still outside it — and loudly rejected on encode:

| Outside the expression dialect | Error code |
|---|---|
| `REGEX`, `MOD`, `EXISTS`, `ELEM_MATCH` operators | `OPERATOR_UNSUPPORTED` |
| Match text that coerces to a non-string (`startsWith(code, '5')`) | `FEATURE_UNSUPPORTED` |
| Field segments colliding with grammar keywords (`null`, `eq`, …) | `FEATURE_UNSUPPORTED` |
| Empty nested compound groups | `FEATURE_UNSUPPORTED` |

See [What fits on the wire](/guide/wire#what-fits-on-the-wire) for the side-by-side dialect comparison.

## Schema-aware encoding

Works exactly like the [simple codec's](/packages/codec-url-simple#schema-aware-encoding), with one dialect difference: the expression filters parser is *precise* — a schema violation in filters always throws (`FiltersParseError`), it is never silently dropped.

## Related

- [@rapiq/codec-url](/packages/codec-url) — accept simple *and* expression payloads on one endpoint.

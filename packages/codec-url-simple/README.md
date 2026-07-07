# @rapiq/codec-url-simple

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Moves a [`Query`](https://rapiq.tada5hi.net/guide/query) over the wire: `URLEncoder` turns the AST into a JSON:API-style URL query string, `URLDecoder` turns a query string (or an express-style `req.query` object) back into the AST.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/codec-url-simple
```

## Usage

### Encoding

```typescript
import { URLEncoder } from '@rapiq/codec-url-simple';

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&include=realm&sort=-age
```

Pass a `SchemaRegistry` to the constructor and `{ schema }` to `encode` for schema-aware encoding — disallowed keys are dropped (or throw with `throwOnFailure`), aliases resolve, `maxLimit` clamps, exactly mirroring the receiving side's decoder.

### Decoding

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

The decoder maps the wire names (`filter`, `page`, `include`, …) to the canonical parameters and delegates to a schema-aware [`SimpleParser`](https://www.npmjs.com/package/@rapiq/parser-simple). Per-parameter helpers (`encodeFields`/`decodeFields`, …) are exported too.

### The round-trip guarantee

Within the dialect's expressible subset, `decode(encode(query)) ≍ query` — equal up to scalar type normalization (the wire is untyped: `'5'` → `5`, `'true'` → `true`). Outside the subset — `or(...)` compounds, multiple conditions per field, `regex`/`mod`/`exists`/`elemMatch`, values colliding with operator markers — `encode` throws a typed error instead of silently changing the query's meaning. For a wider wire subset (nested compounds), use [@rapiq/codec-url-expression](https://www.npmjs.com/package/@rapiq/codec-url-expression).

## Documentation

Full guide (wire format, operator support matrix): [rapiq.tada5hi.net/integrations/url](https://rapiq.tada5hi.net/integrations/url)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

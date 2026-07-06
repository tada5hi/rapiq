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

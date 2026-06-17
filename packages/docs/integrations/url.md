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

const decoder = new URLDecoder();
const query = decoder.decode('filter[age]=>=18&sort=-age&page[limit]=25');
```

`decode(input)` parses the raw string (via [qs](https://www.npmjs.com/package/qs)) and returns a `Query`, or `null` for non-object input. Per-parameter variants: `decodeFields`, `decodeFilters`, `decodePagination`, `decodeRelations`, `decodeSort`.

::: warning Decode does not validate
`URLDecoder` performs no schema validation. When the string comes from an untrusted client, validate it — either parse the qs output with a schema-aware [`SimpleParser`](/integrations/simple):

```typescript
import { parse } from 'qs';
import { SimpleParser } from '@rapiq/parser-simple';

const parser = new SimpleParser(registry);
const query = parser.parse(parse(rawQueryString), { schema: 'user' });
```

— or rely on a framework that already gives you the parsed object (express's `req.query`) and skip the decoder entirely.
:::

## Parameter names

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | `filter[age]=>=18` |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

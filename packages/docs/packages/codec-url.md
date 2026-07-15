# @rapiq/codec-url

`@rapiq/codec-url` moves a [`Query`](/guide/query-ast) over a URL boundary. It writes expression filters by default, stamps the wire dialect in-band, and reads both expression and legacy simple-filter payloads during the v2 migration.

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression @rapiq/codec-url
```

## Usage

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec(schemaRegistry);

const wire = codec.encode(query);
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

const decoded = codec.decode(wire!, { schema: 'user' });
```

The façade owns both directions. Use `encodeAsync()` and `decodeAsync()` when a schema uses asynchronous filter validators.

## Dispatch rules

Encoding uses `url-expression` by default and stamps `codec=url-expression`. Decoding applies these rules in order:

1. A stamped payload dispatches to the named dialect.
2. An unstamped string `filter` is parsed as an expression.
3. An unstamped bracket/object `filter` is parsed as legacy simple input.
4. A payload naming an unknown codec throws `CodecError` with `CODEC_UNRESOLVABLE`.

Input without a filter is dialect-neutral because fields, pagination, relations and sort share one wire grammar.

## Expression dialect

The default filter wire shape is one function-call expression:

```text
codec=url-expression&filter=and(gte(age,'18'),or(eq(status,'active'),eq(status,'pending')))
```

It carries flat filters, repeated fields and nested `and`/`or` trees. Values are quoted, so commas and simple-dialect operator markers retain their literal meaning.

Operators without an expression grammar production—`regex`, `mod`, `exists` and `elemMatch`—throw a typed unsupported error during encoding rather than changing semantics.

## Legacy simple dialect

Existing clients may continue sending JSON:API-style bracket filters:

```text
filter[age]=>=18&filter[status]=active
```

The v2 decoder recognizes that shape without requiring a codec stamp. Simple encoding remains available only as an explicit, deprecated migration escape hatch:

```typescript
import { URL_SIMPLE_CODEC } from '@rapiq/codec-url';

codec.encode(query, { codec: URL_SIMPLE_CODEC });
// codec=url-simple&filter[age]=>=18
```

The simple dialect supports flat root-AND filters only. Nested groups, repeated conditions on one field, and values that collide with its marker grammar throw during encoding.

## Shared URL parameters

| Parameter | URL key | Example |
|---|---|---|
| fields | `fields` | `fields=id,name` / `fields[items]=id` |
| filters | `filter` | expression string or legacy bracket fields |
| pagination | `page` | `page[limit]=25&page[offset]=50` |
| relations | `include` | `include=realm,items` |
| sort | `sort` | `sort=name,-age` |

Within a dialect's supported subset, `decode(encode(query))` restores the same query up to scalar wire normalization (`'5'` becomes `5`, for example).

## Schema-aware transport

Pass the same `SchemaRegistry` used by the receiver and select a schema per operation:

```typescript
const codec = createURLCodec(registry);

const wire = codec.encode(query, { schema: 'user' });
const decoded = codec.decode(wire!, { schema: 'user' });
```

Allow-lists, aliases, defaults, pagination clamps and filter validation then use parser-exact semantics. Parameters absent from the input query remain absent from the wire.

## Custom codecs

Advanced callers can construct `URLCodec`, register a `URLCodecDefinition` (`{ name, encoder, decoder }`) and choose whether it becomes the default. Optional async methods fall back to their synchronous counterparts when omitted.

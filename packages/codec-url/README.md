<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/codec-url</h1>

<p align="center">
  <b>Move a rapiq <code>Query</code> across a URL boundary — and back — losslessly.</b><br>
  Writes self-described expression filters; reads expression <i>and</i> legacy<br>
  JSON:API bracket filters, so applications migrate without a flag day.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/codec-url"><img src="https://img.shields.io/npm/v/@rapiq/codec-url/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/codec-url"><img src="https://img.shields.io/npm/types/@rapiq/codec-url?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/codec-url?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/codec-url"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/codec-url">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
This is the **transport** layer: one façade encodes a `Query` into a query string on the calling side and decodes it back into the same AST on the receiving side.

- 🔁 **Lossless within a dialect** — `decode(encode(query))` restores the same query (modulo scalar type normalization); outside a dialect's subset, `encode` throws a typed error instead of silently changing semantics.
- 🏷️ **In-band codec identity** — encoded payloads carry a reserved `codec` stamp, so decoding dispatches deterministically; unstamped input is probed via registered `detect` hooks.
- 🧭 **Read-both, write-expression** — new payloads use expression filters; the decoder still accepts legacy `filter[name]=…` bracket filters for a gradual v2 migration.
- 🔌 **Express-ready** — feed it a raw query string or a pre-parsed `req.query`; it maps the JSON:API wire names (`filter`, `page`, `include`, …) and validates against your schema.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression @rapiq/codec-url
```

## Usage

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec(schemaRegistry);

codec.encode(query);
// codec=url-expression&filter=or(eq(name,'John'),gte(age,'18'))

codec.decode('codec=url-expression&filter=or(...)', { schema: 'user' });
codec.decode('filter[name]=John', { schema: 'user' }); // legacy simple input
```

Encoding uses `url-expression` by default. During the v2 migration, callers can explicitly request the deprecated simple writer:

```typescript
import { URL_SIMPLE_CODEC } from '@rapiq/codec-url';

codec.encode(query, { codec: URL_SIMPLE_CODEC });
// codec=url-simple&filter[name]=John
```

Decoding dispatches on a stamped codec identifier first. For unstamped input, a string `filter` is treated as an expression and a bracket/object `filter` as the legacy simple dialect. Unknown stamped identifiers throw a typed `CodecError`.

Use `encodeAsync()` and `decodeAsync()` when schema filter validators are asynchronous. Advanced callers can register a custom `URLCodecDefinition` on a `URLCodec` instance.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| **[@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url)** | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide: [rapiq.tada5hi.net/packages/codec-url](https://rapiq.tada5hi.net/packages/codec-url)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

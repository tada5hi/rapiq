<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/parser-simple</h1>

<p align="center">
  <b>Parse plain object/array input — the URL-query-like "simple" dialect — into a rapiq <code>Query</code>.</b><br>
  The workhorse parser the <a href="https://www.npmjs.com/package/@rapiq/codec-url">URL codec</a> builds on.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/parser-simple"><img src="https://img.shields.io/npm/v/@rapiq/parser-simple/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/parser-simple"><img src="https://img.shields.io/npm/types/@rapiq/parser-simple?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/parser-simple?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/parser-simple"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/parser-simple">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
This is the **validate** end for URL-query-shaped input: plain objects and arrays go in, a schema-checked `Query` AST comes out.

- 📥 **URL-query shaped** — the exact structure you get from a query string: `{ fields: [...], filters: {...}, sort: '-age', … }`.
- 🛡️ **Schema-validated** — anything outside the allow-list is dropped by default, or throws with `throwOnFailure`; absent parameters still receive schema defaults.
- 🔣 **Compact operators** — filter values carry inline operators: `'>=18'`, `'~jo~'`, `'!5'`, `null`.
- 🧱 **Per-parameter parsers** — `SimpleFieldsParser`, `SimpleFiltersParser`, … are exported for parsing a single parameter.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple
```

## Usage

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';

const registry = new SchemaRegistry();
registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'] },
    pagination: { maxLimit: 50 },
}));

const parser = new SimpleParser(registry);

const query = parser.parse({
    fields: ['id', 'name'],
    filters: { name: '~jo~', age: '>=18' },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Anything outside the schema's allow-lists is silently dropped; set `throwOnFailure: true` on the schema to get a `ParseError` instead. Parameters absent from the input still receive schema defaults.

The parser is transport-agnostic: it reads the canonical parameter keys (`fields`, `filters`, `pagination`, `relations`, `sort`) only. To consume a raw URL query string or an express-style `req.query` object (JSON:API wire names like `filter`, `page`, `include`), use the [URL codec](https://www.npmjs.com/package/@rapiq/codec-url) — its decoder maps the wire names and delegates to this parser.

Per-parameter parser classes (`SimpleFieldsParser`, `SimpleFiltersParser`, `SimplePaginationParser`, `SimpleRelationsParser`, `SimpleSortParser`) are exported for parsing a single parameter.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| **[@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple)** | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide: [rapiq.tada5hi.net/packages/parser-simple](https://rapiq.tada5hi.net/packages/parser-simple) — per-parameter input shapes and operator syntax are on the [parameter pages](https://rapiq.tada5hi.net/guide/filters).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

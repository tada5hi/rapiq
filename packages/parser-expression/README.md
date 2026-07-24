<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/parser-expression</h1>

<p align="center">
  <b>Parse a function-call filter language into a rapiq <code>Query</code>.</b><br>
  For when a single string must carry a whole condition tree —<br>
  search boxes, saved filters, CLI flags.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/parser-expression"><img src="https://img.shields.io/npm/v/@rapiq/parser-expression/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/parser-expression"><img src="https://img.shields.io/npm/types/@rapiq/parser-expression?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/parser-expression?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/parser-expression"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/parser-expression">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
A tokenizer + recursive-descent parser for a compact, human-readable filter language — the default filter format the [URL codec](https://www.npmjs.com/package/@rapiq/codec-url) writes.

```txt
and(eq(name, 'John'), gte(age, '18'))
or(in(status, 'active', 'pending'), gt(age, '65'))
not(contains(user.name, 'Bob'))
```

- 🧵 **One string, whole tree** — arbitrary `and` / `or` / `not` nesting fits in a single value; ideal for URLs, saved filters and CLI flags.
- 🎯 **Explicit operators** — `eq`, `ne`, `lt(e)`, `gt(e)`, `in`, `nin`, `contains`, `startsWith`, `endsWith`, and their negations — no operator guessing.
- 🛡️ **Fails loud** — syntax errors and schema violations throw `FiltersParseError` immediately; there is no silent-drop mode for malformed expressions.
- 🔗 **Same AST as every dialect** — only `filters` is expression-flavoured; fields, relations, pagination and sort reuse `@rapiq/parser-simple`.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression
```

## Usage

```typescript
import { ExpressionParser } from '@rapiq/parser-expression';

const parser = new ExpressionParser(registry);

const query = parser.parse({
    filters: "and(eq(name, 'John'), gte(age, '18'))",
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the expression language — fields, relations, pagination and sort accept the same input as [@rapiq/parser-simple](https://www.npmjs.com/package/@rapiq/parser-simple), and the whole thing returns the same [`Query`](https://rapiq.tada5hi.net/guide/query-ast) AST. A standalone `parseFilters(input, options)` returns just the `Filters` node.

**The grammar** — `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `nin`, `contains`, `startsWith`, `endsWith` (and negations) as leaf conditions, composed with `and(…)` / `or(…)` / `not(…)`. Values are always single-quoted (`gte(age, '18')`); quoted numerals coerce to numbers, `'true'` / `'false'` to booleans, `'null'` to `null`.

Syntax errors and schema violations throw `FiltersParseError` immediately — the expression parser has no silent-drop mode for malformed expressions.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| **[@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression)** | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide (grammar & operator table): [rapiq.tada5hi.net/packages/parser-expression](https://rapiq.tada5hi.net/packages/parser-expression)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

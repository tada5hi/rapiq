<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/memory</h1>

<p align="center">
  <b>Evaluate a rapiq <code>Query</code> against plain JavaScript objects & arrays.</b><br>
  The in-memory sibling of <code>@rapiq/sql</code> and <code>@rapiq/typeorm</code> — same AST,<br>
  compiled into plain functions instead of SQL.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/memory"><img src="https://img.shields.io/npm/v/@rapiq/memory/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/memory"><img src="https://img.shields.io/npm/types/@rapiq/memory?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/memory?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/memory"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/memory">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
Same visitor-pattern surface as the SQL/TypeORM adapters, but the visitors compile the AST into plain functions (predicate, comparator, projector, slicer) — so the same query filters a database **and** an array.

- ⚡ **Compile once, run many** — the AST is turned into closures up front; apply them across large collections without re-walking the tree.
- 🧪 **No database required** — perfect for tests, mock servers, edge/serverless caches, or filtering data you already hold in memory.
- 🤝 **Backend-parity semantics** — matches `@rapiq/sql` for positive operators and the complement law for negations (`ne` / `nin` / `not*` match null & missing), same-element binding for dotted paths over arrays.
- 🧱 **Whole-query or à la carte** — `applyQuery` runs everything, or compile just the filters / sort / fields / pagination on their own.

```typescript
import { and, eq, gte } from '@rapiq/core';
import { compileFilters } from '@rapiq/memory';

const matches = compileFilters(and(eq('name', 'Peter'), gte('age', 18)));

matches({ name: 'Peter', age: 28 }); // true
matches({ name: 'Peter', age: 16 }); // false
```

## Installation

```sh
npm install @rapiq/core @rapiq/memory
```

## Usage

Apply a whole query to a collection:

```typescript
import { defineQuery } from '@rapiq/core';
import { applyQuery } from '@rapiq/memory';

const query = defineQuery<User>({
    filters: { age: { $gte: 18 } },
    sort: { name: 'ASC' },
    pagination: { limit: 10 },
    fields: ['id', 'name'],
});

const { data, total, pagination } = applyQuery(query, users);
```

Or compile individual parameters:

```typescript
import {
    compileFields,
    compileFilters,
    compilePagination,
    compileSorts,
} from '@rapiq/memory';

const predicate = compileFilters(query.filters);    // (input) => boolean
const comparator = compileSorts(query.sorts);       // (a, b) => number
const projector = compileFields(query.fields);      // (input) => projected
const slicer = compilePagination(query.pagination); // (data) => data page
```

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| **[@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory)** | Evaluate a query against in-memory objects & arrays |

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/packages/memory).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

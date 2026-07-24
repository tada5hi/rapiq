<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/core</h1>

<p align="center">
  <b>The foundation of rapiq — the query AST, the typed build layer & the schema system.</b><br>
  Every other <code>@rapiq/*</code> package builds on the interfaces defined here.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/core"><img src="https://img.shields.io/npm/v/@rapiq/core/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/core"><img src="https://img.shields.io/npm/types/@rapiq/core?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/core?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/core"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/core">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
`@rapiq/core` owns the **intermediate representation** the whole pipeline revolves around: a typed `Query` AST (fields, filters, pagination, relations, sorts), the `defineQuery` build layer, the `Schema` allow-list system, and the visitor interfaces parsers, codecs and backend adapters implement.

- 🧭 **Typed end to end** — every field path in `defineQuery<User>` is checked against the record type; condition helpers (`eq`, `gte`, `and`, `or`, …) replace magic value strings.
- 🌳 **One AST, many consumers** — the same `Query` node graph is walked into SQL, a TypeORM builder or in-memory predicates through the visitor pattern; core never changes when a backend is added.
- 🛡️ **Schema = the receiving side's allow-list** — declare per-parameter `allowed` / `default` / `mapping`; parsers and codecs validate against it and drop or throw per policy.
- 🧩 **Composable & immutable** — `mergeQueries` (left priority) and the `Filters` combinators (`merge`, `and`, `or`) let a gateway scope a query without a client being able to displace injected conditions.

## Installation

```sh
npm install @rapiq/core
```

## Usage

### Build a query

`defineQuery` builds the AST directly from typed input — every field path is checked against the record generic:

```typescript
import { defineQuery, gte, or, eq } from '@rapiq/core';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: or(gte('age', 18), eq('deleted_at', null)),
    relations: ['realm'],
    sort: '-created_at',
    pagination: { limit: 10 },
});
```

Filters accept scalars (`{ name: 'John' }`), bare arrays (`in`, `null` is a legal element), `$`-operator objects (`{ age: { $gte: 18 } }`) and condition helpers (`eq`, `gte`, `inArray`, `and`, `or`, …). Queries compose immutably with `mergeQueries` (left priority) and the `Filters` combinators (`merge`, `and`, `or`).

### Declare what a caller may request

A `Schema` is the receiving side's allow-list — parsers and decoders validate incoming input against it:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const registry = new SchemaRegistry();

registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'] },
    pagination: { maxLimit: 50 },
    schemaMapping: { realm: 'realm' },
}));
```

### Consume the AST

Every node implements `accept(visitor)` — backends implement the visitor interfaces (`IQueryVisitor`, `IFiltersVisitor`, …) to walk a query into whatever they target. Ready-made adapters exist for [SQL](https://www.npmjs.com/package/@rapiq/sql), [TypeORM](https://www.npmjs.com/package/@rapiq/typeorm) and [in-memory data](https://www.npmjs.com/package/@rapiq/memory); parsers and URL codecs live in their own packages as well.

## The rapiq family

| Package | Purpose |
|---|---|
| **[@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core)** | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide: [rapiq.tada5hi.net](https://rapiq.tada5hi.net) — see [Building Queries](https://rapiq.tada5hi.net/guide/building-queries), [Schemas](https://rapiq.tada5hi.net/guide/schemas) and [Merging Queries](https://rapiq.tada5hi.net/guide/merging-queries).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

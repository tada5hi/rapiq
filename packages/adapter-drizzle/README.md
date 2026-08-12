<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/adapter-drizzle</h1>

<p align="center">
  <b>Turn a rapiq <code>Query</code> into a Drizzle relational query config.</b><br>
  A pure serializer: nothing is mutated, no database is touched,<br>
  and <code>drizzle-orm</code> is not a dependency.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/adapter-drizzle"><img src="https://img.shields.io/npm/v/@rapiq/adapter-drizzle?color=%23a21caf&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/adapter-drizzle"><img src="https://img.shields.io/npm/types/@rapiq/adapter-drizzle?color=%23db2777" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/adapter-drizzle?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/adapter-drizzle"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/adapter-drizzle">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq). Typed REST queries: *build, transport, validate, execute.*
This adapter targets Drizzle's relational queries v2 API (drizzle-orm v1): `execute(query)` returns the plain config object you hand straight to `db.query.<table>.findMany()`.

- 🧾 **Just a value**: `execute(query)` returns `{ config, pagination }`. Nothing is mutated, so the adapter is trivial to test, log, cache or post-process.
- 🔗 **Zero coupling**: `drizzle-orm` is neither a runtime nor a peer dependency; it is a devDependency only, because the test suite runs the emitted configs through a real engine.
- 🧮 **Exact semantics**: negation is the null-inclusive complement and conditions on one to-many path bind to the same element, exactly as in `@rapiq/adapter-sql`, `@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma` and `@rapiq/adapter-memory`. Drizzle's three-valued `NOT` is never applied to a user condition.
- 🔬 **Measured, not modelled**: the parity suite executes every condition through a real drizzle engine (in-memory SQLite by default, PostgreSQL in CI) and cross-checks it against `@rapiq/adapter-memory`.

```typescript
import { DrizzleAdapter, defineMetadata } from '@rapiq/adapter-drizzle';

const adapter = new DrizzleAdapter({
    provider: 'pg',
    metadata: defineMetadata(datamodel, 'users'),
});

const { config, pagination } = adapter.execute(query);

const users = await db.query.users.findMany(config);
```

## Installation

```sh
npm install @rapiq/core @rapiq/adapter-drizzle
```

Requires drizzle-orm v1 (relational queries v2) on the consuming side; the adapter itself imports nothing from it.

## What a query becomes

| Query parameter | findMany config key |
|---|---|
| `filters` | `where` |
| `fields` | `columns` |
| `relations` | `with`, narrowed by per-relation field picks |
| `sorts` | `orderBy` (key order carries the priority) |
| `pagination` | `limit` / `offset` |

`pagination` is echoed back from `execute()` as the limit/offset actually applied, ready for a response `meta` block.

## Table metadata

The adapter needs four facts about your tables that a `Query` cannot carry, and each one changes what a *correct* drizzle filter looks like:

| fact | what it decides |
|---|---|
| is the path a relation? | a relation takes a nested filter object or a presence test, never a column operator |
| is that relation to-many? | the shape of the empty-collection arm of a complement |
| can the column hold `null`? | whether a complement carries its `isNull` arm |
| does it hold strings? | only string columns fold case through `ilike` |

Guessing any of them produces a wrong result set rather than graceful degradation, so `metadata` and `provider` are required. The datamodel is a plain object in drizzle's own vocabulary:

```typescript
const metadata = defineMetadata({
    users: {
        columns: {
            id: { dataType: 'number', nullable: false },
            name: 'string',
        },
        relations: {
            items: { target: 'items', many: true },
            realm: { target: 'realms', many: false },
        },
    },
    items: { /* ... */ },
    realms: { /* ... */ },
}, 'users');
```

## Preserving an application-owned predicate

Rapiq filters **narrow** a query, they never replace it. Pass a baseline config and the caller's conditions are conjoined with your tenant or authorization scope:

```typescript
const { config } = adapter.execute(query, {
    base: { where: { realm_id: realmId } },
});

// where: { AND: [ { realm_id: ... }, { ...client filters } ] }
```

The merge rules behind `base` are exported as `mergeConfig(base, override)` for use outside the adapter.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system (the shared foundation) |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/adapter-sql](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/adapter-prisma](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-prisma) | Serialize a query into a Prisma argument object |
| **[@rapiq/adapter-drizzle](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-drizzle)** | Serialize a query into a Drizzle relational query config |
| [@rapiq/adapter-memory](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide (dialect presets, table metadata, limitations): [rapiq.tada5hi.net/packages/adapter-drizzle](https://rapiq.tada5hi.net/packages/adapter-drizzle)

## License

MIT

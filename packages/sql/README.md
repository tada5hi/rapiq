<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/sql</h1>

<p align="center">
  <b>Turn a rapiq <code>Query</code> into parameterized SQL fragments — for any dialect.</b><br>
  Database-agnostic core, five ready-made presets (<code>pg</code>, <code>mysql</code>, <code>sqlite</code>, <code>mssql</code>, <code>oracle</code>),<br>
  values always <b>bound</b>, never interpolated.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/sql"><img src="https://img.shields.io/npm/v/@rapiq/sql/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/sql"><img src="https://img.shields.io/npm/types/@rapiq/sql?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/sql?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/sql"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/sql">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
This is the dialect-agnostic **execute** layer: it renders a validated `Query` into clause fragments you compose into a `SELECT`. It is also the foundation the [TypeORM adapter](https://www.npmjs.com/package/@rapiq/typeorm) builds on.

- 🔒 **Parameterized always** — filter values are bound, never string-interpolated. No SQL injection surface.
- 🐘 **Five dialects, one adapter** — `pg`, `mysql`, `sqlite`, `mssql`, `oracle` presets; per-database behaviour is a tiny `DialectOptions` object you can also supply yourself.
- 🧮 **Sensible SQL** — `null` → `IS NULL` / `IS NOT NULL`, empty `IN` → `1 = 0` (never invalid SQL), case-insensitive string matching folded consistently across dialects.
- 🔧 **Fragment-level control** — render a whole query, or just the filters, or just the sort — each parameter has a standalone adapter/visitor pair.

## Installation

```sh
npm install @rapiq/core @rapiq/sql
```

## Usage

A root `Adapter` bundles one sub-adapter per parameter; `execute(query)` walks a whole `Query` into it and returns the accumulated clause fragments:

```typescript
import { Adapter, pg } from '@rapiq/sql';

const adapter = new Adapter({ ...pg, rootAlias: 'user' });

const fragments = adapter.execute(query);
// {
//     columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
//     where: '("user"."age" >= $1 and ...)',
//     params: [18, ...],
//     orderBy: ['"user"."age" DESC'],
//     limit: 25,
//     offset: 50,
//     relations: ['realm'],
// }
```

Construct the `Adapter` **per request** — it accumulates per-call state, so the shareable, long-lived part is the options object, not the adapter instance.

Per-parameter adapter/visitor pairs work standalone — e.g. rendering just the filters:

```typescript
import { FiltersAdapter, FiltersVisitor, RelationsAdapter, pg } from '@rapiq/sql';

const filters = new FiltersAdapter(new RelationsAdapter(), pg);
query.filters.accept(new FiltersVisitor(filters));

const [sql, params] = filters.getQueryAndParameters();
// sql:    ("name" ~* $1 and "age" >= $2)
// params: ['jo', 18]
```

The package deliberately stops at fragments: composing the final `SELECT` — in particular `FROM` / `JOIN` conditions — is the caller's job, or a backend adapter's (that's exactly what [@rapiq/typeorm](https://www.npmjs.com/package/@rapiq/typeorm) does).

**Notable semantics** — `null` filter values render as `IS NULL` / `IS NOT NULL`; empty `IN` lists render as `1 = 0` (never invalid SQL); string-matching operators match literally on every dialect; and `resolveDialect(name)` maps driver/connection type names (`postgres`, `mariadb`, `better-sqlite3`, …) to the matching preset. On dialects without a regexp operator (SQL Server, stock SQLite), `contains` / `startsWith` / `endsWith` fall back to escaped `LIKE`; only the `regex` operator throws a typed `AdapterError`.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| **[@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql)** | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide (dialects, null semantics, fragment API): [rapiq.tada5hi.net/packages/sql](https://rapiq.tada5hi.net/packages/sql)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

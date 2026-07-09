# @rapiq/sql

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Turns query AST nodes into **parameterized SQL fragments**. Database-agnostic: per-database behavior is injected as a small dialect option object (presets for `pg`, `mysql`, `sqlite`, `mssql`, `oracle`), and values are always bound as parameters — never interpolated. It is also the foundation the [TypeORM adapter](https://www.npmjs.com/package/@rapiq/typeorm) builds on.

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

The package deliberately stops at fragments: composing the final `SELECT` — in particular `FROM`/`JOIN` conditions — is the caller's job, or a backend adapter's (that's exactly what [@rapiq/typeorm](https://www.npmjs.com/package/@rapiq/typeorm) does).

Notable semantics: `null` filter values render as `IS NULL` / `IS NOT NULL` predicates, empty `IN` lists render as `1 = 0` (never invalid SQL), string-matching operators match literally on every dialect, and `resolveDialect(name)` maps driver/connection type names (`postgres`, `mariadb`, `better-sqlite3`, …) to the matching preset. On dialects without a regexp operator (SQL Server, stock SQLite), `contains`/`startsWith`/`endsWith` fall back to escaped `LIKE`; only the `regex` operator throws a typed `AdapterError`.

## Documentation

Full guide (dialects, null semantics, fragment API): [rapiq.tada5hi.net/integrations/sql](https://rapiq.tada5hi.net/integrations/sql)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

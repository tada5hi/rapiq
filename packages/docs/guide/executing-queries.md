# Executing Queries

A validated `Query` becomes results through an **adapter**. Three ship with rapiq — pick by where your data lives:

| Adapter | Target | Returns |
|---|---|---|
| [@rapiq/typeorm](/packages/typeorm) | TypeORM `SelectQueryBuilder` | mutates the builder in place |
| [@rapiq/sql](/packages/sql) | any SQL driver | parameterized SQL fragments |
| [@rapiq/memory](/packages/memory) | plain objects & arrays | compiled functions / filtered data |

All three consume the same AST, and they agree on semantics: the records a query selects in memory are the records it selects in the database.

## TypeORM

The most common server setup — the adapter applies filters as parameterized `WHERE` conditions, relations as joins, fields/sort/pagination as `select`/`orderBy`/`take`+`skip`:

```typescript
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    queryBuilder,
    relations: { joinAndSelect: true },
});

const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();
```

`execute` returns the applied pagination — handy for the response `meta` block. Existing builder predicates are preserved and rapiq filters are appended with `AND`, so tenant or authorization scopes applied before `execute` cannot be erased. Options (join types, the `onJoin` hook, alias conventions) are on the [package page](/packages/typeorm).

## Raw SQL

No ORM? `@rapiq/sql` renders clause fragments you compose into your own statement. Per-database behavior is a small dialect preset (`pg`, `mysql`, `sqlite`, `mssql`, `oracle`):

```typescript
import { Adapter, pg } from '@rapiq/sql';

const adapter = new Adapter({ ...pg, rootAlias: 'user' });

const fragments = adapter.execute(query);
// {
//     columns: ['"user"."id"', '"user"."name"'],
//     where: '("user"."age" >= $1)',
//     params: [18],
//     orderBy: ['"user"."age" DESC'],
//     limit: 25, offset: 0,
//     relations: ['realm'],
// }
```

Values are always bound as parameters — never interpolated into the SQL string. Composing the final `SELECT` (in particular `FROM`/`JOIN`) stays your job, because it needs knowledge of your table layout. Details: [@rapiq/sql](/packages/sql).

## In memory

`@rapiq/memory` compiles the same query into plain functions — for authorization guards that must agree with the database, filtering already-loaded collections, or mock backends in tests:

```typescript
import { applyQuery, compileQuery } from '@rapiq/memory';

// one-shot: filter → sort → paginate → project
const { data, total, pagination } = applyQuery(query, users);

// or compile once and reuse
const compiled = compileQuery<User>(query);
compiled.matches(user);   // filters as a predicate -> boolean
compiled.apply(users);    // whole query against a collection
```

Semantics (null handling, string matching, join-row binding) mirror the SQL adapters — see [@rapiq/memory](/packages/memory).

## One adapter instance per request

SQL and TypeORM adapters accumulate per-call state. Construct them **per request** — the shareable, long-lived part is the options object, not the adapter instance:

```typescript
// module scope — the reusable config
const config = { relations: { joinAndSelect: true } };

// per request
new TypeormAdapter({ ...config, queryBuilder }).execute(query);
```

## Applying a single parameter

A `Query` with only some parameters set applies just those — the rest are empty and become no-ops:

```typescript
import { Query } from '@rapiq/core';

adapter.execute(new Query({ filters: query.filters }));
```

Each backend also exposes per-parameter building blocks (sub-adapters, `compile*` helpers) — see the package pages.

## Next steps

- [Recipes: REST API with Express & TypeORM](/guide/recipes/express-typeorm) — the full endpoint.
- [Recipes: Authorization & scoping](/guide/recipes/authorization) — injected filters + memory-guard parity.
- [The Query AST](/guide/query-ast) — implement an adapter for a new backend.

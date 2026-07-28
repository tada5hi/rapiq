# Executing Queries

A validated `Query` becomes results through an **adapter**. Four ship with rapiq; pick by where your data lives:

| Adapter | Target | Returns |
|---|---|---|
| [@rapiq/adapter-typeorm](/packages/adapter-typeorm) | TypeORM `SelectQueryBuilder` | mutates the builder in place |
| [@rapiq/adapter-prisma](/packages/adapter-prisma) | Prisma Client | a `findMany` argument object |
| [@rapiq/adapter-sql](/packages/adapter-sql) | any SQL driver | parameterized SQL fragments |
| [@rapiq/adapter-memory](/packages/adapter-memory) | plain objects & arrays | compiled functions / filtered data |

All four consume the same AST, and they agree on semantics: the records a query selects in memory are the records it selects in the database.

## TypeORM

The most common server setup — the adapter applies filters as parameterized `WHERE` conditions, relations as joins, fields/sort/pagination as `select`/`orderBy`/`take`+`skip`:

```typescript
import { TypeormAdapter } from '@rapiq/adapter-typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    queryBuilder,
    relations: { joinAndSelect: true },
});

const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();
```

`execute` returns the applied pagination — handy for the response `meta` block. Existing builder state is preserved: rapiq filters are appended with `AND` (under namespaced parameter bindings), and a query without sorts or pagination leaves a caller-owned `ORDER BY`/`take`/`skip` untouched — so tenant or authorization scopes applied before `execute` cannot be erased. Options (join types, the `onJoin` hook, alias conventions) are on the [package page](/packages/adapter-typeorm).

## Prisma

Prisma takes an argument object rather than a builder, so the adapter is a pure serializer that returns the object and touches nothing:

```typescript
import { PrismaAdapter } from '@rapiq/adapter-prisma';

const adapter = new PrismaAdapter<Prisma.UserFindManyArgs>({ model: prisma.user });

const { args, pagination } = adapter.execute(query);

const users = await prisma.user.findMany(args);
```

Because this adapter is model-bound, it can also run the request itself:

```typescript
const rows = await adapter.findMany(query, {
    base: { where: { realm_id } },  // an application-owned scope, conjoined
});
const total = await adapter.count(query);  // pre-pagination, for the meta block
```

Unlike the builder-bound adapters, one `PrismaAdapter` instance is stateless and safely shared across requests. The [package page](/packages/adapter-prisma) covers the provider presets (`mode: 'insensitive'` support) and how negation is rendered exactly despite Prisma's three-valued `NOT`.

## Raw SQL

No ORM? `@rapiq/adapter-sql` renders clause fragments you compose into your own statement. Per-database behavior is a small dialect preset (`pg`, `mysql`, `sqlite`, `mssql`, `oracle`):

```typescript
import { Adapter, pg } from '@rapiq/adapter-sql';

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

Values are always bound as parameters — never interpolated into the SQL string. Composing the final `SELECT` (in particular `FROM`/`JOIN`) stays your job, because it needs knowledge of your table layout. Details: [@rapiq/adapter-sql](/packages/adapter-sql).

## In memory

`@rapiq/adapter-memory` compiles the same query into plain functions — for authorization guards that must agree with the database, filtering already-loaded collections, or mock backends in tests:

```typescript
import { applyQuery, compileQuery } from '@rapiq/adapter-memory';

// one-shot: filter → sort → paginate → project
const { data, total, pagination } = applyQuery(query, users);

// or compile once and reuse
const compiled = compileQuery<User>(query);
compiled.matches(user);   // filters as a predicate -> boolean
compiled.apply(users);    // whole query against a collection
```

Semantics (null handling, string matching, join-row binding) mirror the SQL adapters — see [@rapiq/adapter-memory](/packages/adapter-memory).

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

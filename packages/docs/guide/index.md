# What is rapiq?

Rapiq (**R**est **Api** **Q**uery) gives the two sides of an HTTP API **one shared query language** for list endpoints — filtering, sorting, pagination, sparse field selection and relation loading, modeled after the [JSON:API](https://jsonapi.org/format/) query parameters.

The caller builds a **typed query**, sends it as an ordinary URL query string, and the receiving application validates it against an **allow-list schema** before turning it into a database query. No hand-rolled `req.query` parsing, no string concatenation, no guessing which parameters a client may touch.

```
?filter[age]=>=18&include=realm&sort=-age&page[limit]=25&fields=id,name
```

## The 30-second tour

**Caller** — build a query against your record type and encode it:

```typescript
import { defineQuery } from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

const query = defineQuery<User>({
    filters: { age: { $gte: 18 } },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25 },
});

const response = await fetch(`/users?${new URLEncoder().encode(query)}`);
```

**Receiver** — decode it against a schema that says what clients may request, then hand it to your database:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { URLDecoder } from '@rapiq/codec-url-simple';
import { TypeormAdapter } from '@rapiq/typeorm';

const registry = new SchemaRegistry();
registry.add(defineSchema<User>({
    name: 'user',
    filters: { allowed: ['age', 'name'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['age', 'name'] },
    pagination: { maxLimit: 50 },
}));

const query = new URLDecoder(registry).decode(req.query, { schema: 'user' });

new TypeormAdapter({ queryBuilder }).execute(query);
const [entities, total] = await queryBuilder.getManyAndCount();
```

Everything a client sends outside the allow-lists is dropped (or rejected — your choice) before it ever reaches the database.

## How it works

A query passes through four stages — and every rapiq package plays exactly one role in one of them:

<QueryPipeline />

1. **Build** — the caller describes what it wants with [`defineQuery`](/guide/building-queries), typed against the record.
2. **Send** — a [codec](/guide/wire) turns the query into an ordinary URL query string, and back.
3. **Validate** — the receiver parses against a [schema](/guide/schemas): the allow-list decides what survives.
4. **Execute** — an [adapter](/guide/executing-queries) translates the validated query for your backend.

Because the pieces only meet in the [`Query`](/guide/query-ast), they compose freely: swap the wire dialect without touching the database code, add a new backend without touching the parsers, or skip the wire entirely and evaluate a query in memory.

## The five parameters

| Parameter | URL key | What it does |
|---|---|---|
| [Fields](/guide/fields) | `fields` | Select which resource fields are returned. |
| [Filters](/guide/filters) | `filter` | Narrow the collection by conditions. |
| [Relations](/guide/relations) | `include` | Load related resources alongside the primary one. |
| [Sort](/guide/sort) | `sort` | Order the collection by one or more keys. |
| [Pagination](/guide/pagination) | `page` | Limit and offset the collection. |

## The package family

Install only what each side of your application needs — `@rapiq/core` is the shared foundation.

| Role | Packages |
|---|---|
| **Build & compose** | [@rapiq/core](/packages/core) — the query AST, `defineQuery`, condition helpers, schemas |
| **Parse input** | [@rapiq/parser-simple](/packages/parser-simple) · [@rapiq/parser-expression](/packages/parser-expression) · [@rapiq/parser-mongo](/packages/parser-mongo) |
| **Cross the wire** | [@rapiq/codec-url-simple](/packages/codec-url-simple) · [@rapiq/codec-url-expression](/packages/codec-url-expression) · [@rapiq/codec-url](/packages/codec-url) |
| **Execute** | [@rapiq/typeorm](/packages/typeorm) · [@rapiq/sql](/packages/sql) · [@rapiq/memory](/packages/memory) |

See the [package overview](/packages/) for the full map and a "which packages do I need?" guide.

## When is rapiq a good fit?

- Your API exposes **list endpoints** and clients need to filter, sort, paginate or shape the result.
- You want the query surface **declared, typed and enforced** instead of scattered across handlers.
- You want the **same query semantics** everywhere — SQL, TypeORM, in-memory guards, tests.

It deliberately does **not** define the response format, replace your ORM, or generate endpoints — it only standardizes what a query *is* and what a client *may* ask for.

::: warning Version 2
These docs cover the upcoming **version 2**, which splits the former single `rapiq` package into focused `@rapiq/*` packages. The v1 documentation lives on the [v1 branch](https://github.com/tada5hi/rapiq/tree/v1); see [Migration from v1](/guide/migration-v1).
:::

## Next steps

- [Installation](/guide/installation) — add the packages for your side of the wire.
- [Quick Start](/guide/quick-start) — caller to database in one walkthrough.
- [Core Concepts](/guide/concepts) — the four moving parts, explained once.

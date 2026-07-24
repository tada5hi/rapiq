<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/typeorm</h1>

<p align="center">
  <b>Apply a rapiq <code>Query</code> straight to a TypeORM <code>SelectQueryBuilder</code>.</b><br>
  Filters become parameterized <code>WHERE</code> conditions, relations become joins,<br>
  <code>fields</code> / <code>sort</code> / <code>pagination</code> map to <code>select</code> / <code>orderBy</code> / <code>take</code>&nbsp;+&nbsp;<code>skip</code>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/typeorm"><img src="https://img.shields.io/npm/v/@rapiq/typeorm/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/typeorm"><img src="https://img.shields.io/npm/types/@rapiq/typeorm?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/typeorm?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/typeorm"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/typeorm">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
This is the **execute** end for [TypeORM](https://typeorm.io): hand it a validated `Query` and a builder, get back a fully-shaped query.

## Why

You decoded and validated a request query — now it has to become a real database query **without** losing your own tenant/auth scoping and **without** hand-writing `andWhere` glue for every parameter. That is all this package does, in one `execute(query)` call.

- 🧩 **Drop-in** — bind your `SelectQueryBuilder`, call `execute(query)`, run it. Nothing else to wire.
- 🔒 **Injection-safe** — every filter value is bound as a parameter, never string-interpolated.
- 🤝 **Keeps your predicates** — filters are applied with `andWhere`, so tenant/auth `WHERE`s already on the builder survive untouched.
- 🔗 **Relations → joins** — `leftJoinAndSelect` (or `inner`), applied idempotently, validated against the entity metadata, with deterministic aliases shared with `@rapiq/sql`.
- 🎛️ **Dialect-aware** — the SQL dialect is inferred from the builder's connection; case-folding is applied only to string columns (no `lower(int)` errors on Postgres).
- ↩️ **Familiar defaults** — mirrors typeorm-extension's `applyQuery` contract (`leftJoinAndSelect`, returned pagination) for a painless migration.

## What a query becomes

A single `adapter.execute(query)` walks the parsed AST and applies it to your builder:

| Query parameter | Applied to the `SelectQueryBuilder` |
|---|---|
| `filters: { age: gte(18) }` | `.andWhere('"user"."age" >= :p0', { p0: 18 })` |
| `relations: ['realm']` | `.leftJoinAndSelect('user.realm', 'realm')` |
| `fields: ['id', 'name']` | `.select(['user.id', 'user.name'])` |
| `sort: '-createdAt'` | `.orderBy('user.createdAt', 'DESC')` |
| `pagination: { limit, offset }` | `.take(limit).skip(offset)` |

## Installation

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

### Quick start

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

The `queryBuilder` is bound at construction; `adapter.execute(query)` walks the parsed `Query`, collects the state into its sub-adapters, applies it to that builder, and returns the pagination it applied (handy for the response `meta` block).

Construct the adapter **per request**, like the `SelectQueryBuilder` you hand it — it holds per-call state. The shareable, long-lived part is your config (`relations`, …), spread into the per-request options with the request's builder as `queryBuilder`.

### In a request handler

The query usually arrives from a [URL decoder](https://www.npmjs.com/package/@rapiq/codec-url) that validated `req.query` against a schema. Filters are applied with `andWhere`, so any application-owned scoping already on the builder (tenant, auth, soft-delete) survives untouched:

```typescript
import { createURLCodec } from '@rapiq/codec-url';
import { TypeormAdapter } from '@rapiq/typeorm';

const codec = createURLCodec(registry); // registry: your SchemaRegistry

app.get('/users', async (req, res) => {
    const query = codec.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end();
    }

    const queryBuilder = dataSource
        .getRepository(User)
        .createQueryBuilder('user')
        // application-owned scoping — preserved, never overwritten
        .where('user.realm_id = :realmId', { realmId: req.realmId });

    const { pagination } = new TypeormAdapter({
        queryBuilder,
        relations: { joinAndSelect: true },
    }).execute(query);

    const [data, total] = await queryBuilder.getManyAndCount();

    res.json({ data, meta: { total, ...pagination } });
});
```

### Relation join strategies

A relation referenced only by a filter or sort is joined **without** being selected; an `include`d relation is hydrated according to your options:

```typescript
// hydrate included relations — leftJoinAndSelect (records with no relation are kept)
new TypeormAdapter({
    queryBuilder,
    relations: { joinAndSelect: true },
}).execute(query);

// inner join + id-only hydration that survives GROUP BY user.id on strict dialects
new TypeormAdapter({
    queryBuilder,
    relations: {
        joinAndSelect: true,
        joinType: 'inner',
        hydrationMode: 'key',
        onJoin: (path, alias, qb) => qb.addGroupBy(`${alias}.id`),
    },
}).execute(query);
```

| `relations` option | Effect |
|---|---|
| `joinAndSelect` | Hydrate related entities (`leftJoinAndSelect`) instead of joining for filtering only. |
| `joinType` | `'left'` (default, keeps records with an absent relation) or `'inner'`. |
| `hydrationMode` | `'full'` (default) selects the whole related subtree; `'key'` selects only the related primary key, so a hydrated relation survives `GROUP BY <root>.id`. |
| `onJoin(path, alias, queryBuilder)` | Invoked per applied join (pre-existing/skipped joins don't trigger it) — extend the query, e.g. add a group-by or an extra condition. |

The SQL dialect is resolved from the attached builder's connection type; joins are applied idempotently and validated against the entity metadata.

### Applying part of a query

`adapter.execute()` runs everything, but the per-parameter sub-adapters (`adapter.filters`, `adapter.sort`, `adapter.fields`, …) are public — pair one with its matching [@rapiq/sql](https://www.npmjs.com/package/@rapiq/sql) visitor to apply a single parameter:

```typescript
import { FiltersVisitor } from '@rapiq/sql';

const adapter = new TypeormAdapter({ queryBuilder });

query.filters.accept(new FiltersVisitor(adapter.filters)); // collect
adapter.filters.execute();                                 // flush to the builder
```

`execute()` also takes per-call options: `{ clear: false }` accumulates several queries onto the same builder, and `{ visitor: { caseSensitive: ['token'] } }` opts specific fields out of the case-insensitive equality default.

Migrating from typeorm-extension's `applyQuery`? The defaults mirror its contract (`leftJoinAndSelect`, returned pagination) — see the [migration guide](https://rapiq.tada5hi.net/guide/migration-typeorm-extension). For the complete walkthrough, follow the [end-to-end Express + TypeORM recipe](https://rapiq.tada5hi.net/guide/recipes/express-typeorm).

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| **[@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm)** | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide (options, dialect detection, alias convention): [rapiq.tada5hi.net/packages/typeorm](https://rapiq.tada5hi.net/packages/typeorm)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

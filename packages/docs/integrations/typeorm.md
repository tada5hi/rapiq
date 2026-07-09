# TypeORM

`@rapiq/typeorm` applies a parsed [`Query`](/guide/query) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

```typescript
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    target: queryBuilder,
    relations: { joinAndSelect: true },
});

const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();
```

The `target` (the builder to write into) is bound at construction; `execute(query)` then walks the parsed `Query` (the AST), collects the state into its sub-adapters, and applies it to that builder — returning the applied pagination (e.g. for the response `meta` block).

Construct the adapter **per request**, just like the `SelectQueryBuilder` you hand it — it holds per-call state. The shareable, long-lived part is your config (`relations`, …), which you spread into the per-request options alongside the request's builder:

```typescript
// module scope — the reusable config
const config = { relations: { joinAndSelect: true } };

// per request — add the request's builder as `target`
new TypeormAdapter({ ...config, target: queryBuilder }).execute(query);
```

By default each call clears any previously accumulated state, so an adapter instance is re-runnable. Pass `{ clear: false }` as the second argument to apply several queries onto the same builder, and `{ visitor }` to forward options to the underlying visitors:

```typescript
adapter.execute(query, { clear: false });
```

## Dialect detection

The adapter resolves the SQL dialect from the attached query builder's connection type (`postgres`, `mysql`/`mariadb`, `sqlite`/`better-sqlite3`, `mssql`, `oracle`, …). Field escaping is delegated to the query builder itself; regexp conditions use the matching [dialect preset](/integrations/sql#dialects) — on regexp-less dialects (SQLite, SQL Server) the `contains` / `startsWith` / `endsWith` operators fall back to `LIKE`, and the `regex` operator throws a typed `AdapterError`. When no query builder is bound (or the connection type is unknown), the postgres preset is the documented last-resort default.

## Options

```typescript
new TypeormAdapter({
    relations: {
        joinAndSelect: true,
        joinType: 'left',
        onJoin: (path, alias, queryBuilder) => {
            queryBuilder.addGroupBy(`${alias}.id`);
        },
    },
});
```

| Option | Description |
|---|---|
| `relations.joinAndSelect` | Join **and select** (hydrate the related entities) instead of joining for filtering/sorting only. |
| `relations.joinType` | `'left'` (default) or `'inner'`. Left joins keep records whose relation is absent. |
| `relations.onJoin` | Invoked as `(path, alias, queryBuilder)` for every join the adapter applies — e.g. to `addGroupBy` per join when the root query is grouped. Skipped (pre-existing) joins don't trigger it. |

Relations are validated against the entity metadata of the attached query builder — a requested relation that doesn't exist on the entity is ignored. Joins are applied idempotently: relations already joined on the query builder (by the adapter or by your own code, matched by alias) are skipped, so applying a query twice does not duplicate joins.

::: warning Alias convention
Joins are aliased by the relation path's **last segment**: `role.realm` joins as alias `realm` — the same convention filter/sort/field references resolve against. Two relation paths ending in the same segment (e.g. `realm` and `role.realm`) therefore collide: the later join is skipped and references resolve against the first one. Path-qualified aliases are tracked in [#744](https://github.com/tada5hi/rapiq/issues/744).
:::

::: info Migrating from typeorm-extension
`applyQuery` used `leftJoinAndSelect` and returned the parsed pagination — `joinType: 'left'` (the default) and the `execute(query)` return value mirror that contract. The `onJoin` hook is the equivalent of typeorm-extension's `relations.onJoin`.
:::

## Applying a single parameter

A `Query` with only some parameters set applies just those — the rest are empty and become no-ops. To apply, say, only the filters of a parsed query:

```typescript
import { Query } from '@rapiq/core';

const adapter = new TypeormAdapter({ target: queryBuilder });
adapter.execute(new Query({ filters: query.filters }));
```

For lower-level control, each per-parameter sub-adapter (`adapter.filters`, `adapter.fields`, `adapter.sort`, `adapter.pagination`, `adapter.relations`) pairs with the matching `@rapiq/sql` visitor (`FiltersVisitor`, `FieldsVisitor`, `SortsVisitor`, `PaginationVisitor`, `RelationsVisitor`) and applies via its own `execute()` — the target is already bound from the adapter's construction.

## End-to-end example

```typescript
import { Request, Response } from 'express';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { URLDecoder } from '@rapiq/codec-url-simple';
import { TypeormAdapter } from '@rapiq/typeorm';
// your app's TypeORM DataSource instance
import { dataSource } from './data-source';

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

const decoder = new URLDecoder(registry);

export async function getUsers(req: Request, res: Response) {
    // wire names (filter, page, include, ...) map to canonical parameters
    const query = decoder.decode(req.query, { schema: 'user' });
    if (!query) {
        // decode returns null for non-object input
        return res.status(400).end();
    }

    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    const adapter = new TypeormAdapter({ target: queryBuilder, relations: { joinAndSelect: true } });
    const { pagination } = adapter.execute(query);

    const [entities, total] = await queryBuilder.getManyAndCount();

    return res.json({
        data: entities,
        meta: {
            total,
            limit: pagination.limit,
            offset: pagination.offset,
        },
    });
}
```

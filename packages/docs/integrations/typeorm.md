# TypeORM

`@rapiq/typeorm` applies a parsed [`Query`](/guide/query) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

```typescript
import { QueryVisitor } from '@rapiq/sql';
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    relations: { joinAndSelect: true },
});
adapter.withQuery(queryBuilder);

query.accept(new QueryVisitor(adapter));
const { pagination } = adapter.execute();

const [entities, total] = await queryBuilder.getManyAndCount();
```

The flow is always the same:

1. `withQuery(queryBuilder)` — attach the builder.
2. `query.accept(new QueryVisitor(adapter))` — walk the AST; the adapter collects state.
3. `adapter.execute()` — apply everything to the builder in one go; it returns the applied pagination (e.g. for the response `meta` block).

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

::: info Migrating from typeorm-extension
`applyQuery` used `leftJoinAndSelect` and returned the parsed pagination — `joinType: 'left'` (the default) and the `execute()` return value mirror that contract. The `onJoin` hook is the equivalent of typeorm-extension's `relations.onJoin`.
:::

## Applying a single parameter

Per-parameter visitors from `@rapiq/sql` work against the adapter's sub-adapters when only part of a query applies:

```typescript
import { FiltersVisitor } from '@rapiq/sql';

const adapter = new TypeormAdapter();
adapter.withQuery(queryBuilder);

query.filters.accept(new FiltersVisitor(adapter.filters));
adapter.execute();
```

The same pattern works with `FieldsVisitor` (`adapter.fields`), `SortsVisitor` (`adapter.sort`), `PaginationVisitor` (`adapter.pagination`) and `RelationsVisitor` (`adapter.relations`).

## End-to-end example

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import { QueryVisitor } from '@rapiq/sql';
import { TypeormAdapter } from '@rapiq/typeorm';

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

const parser = new SimpleParser(registry);

export async function getUsers(req: Request, res: Response) {
    const query = parser.parse(req.query, { schema: 'user' });

    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    const adapter = new TypeormAdapter({ relations: { joinAndSelect: true } });
    adapter.withQuery(queryBuilder);
    query.accept(new QueryVisitor(adapter));
    const { pagination } = adapter.execute();

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

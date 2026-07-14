# @rapiq/typeorm

Applies a parsed [`Query`](/guide/query-ast) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

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

The `queryBuilder` (the builder to write into) is bound at construction; `execute(query)` then walks the parsed `Query`, collects the state into its sub-adapters, and applies it to that builder — returning the applied pagination (e.g. for the response `meta` block).

Construct the adapter **per request**, just like the `SelectQueryBuilder` you hand it — it holds per-call state. The shareable, long-lived part is your config, which you spread into the per-request options:

```typescript
// module scope — the reusable config
const config = { relations: { joinAndSelect: true } };

// per request — add the request's builder as `queryBuilder`
new TypeormAdapter({ ...config, queryBuilder }).execute(query);
```

By default each call clears the adapter's own accumulated state. The bound `queryBuilder`, however, is mutated in place — joins and the selected projection are not rolled back — so build a fresh adapter (with a fresh builder) per query rather than re-running one onto an already-applied builder. Pass `{ clear: false }` as the second argument to accumulate several queries' conditions onto the same builder, and `{ visitor }` to forward options to the underlying visitors:

```typescript
adapter.execute(query, { clear: false });
```

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
| `relations.relationAlias` | Derive the join alias for a relation path (default: the path with `.` replaced by `_`, e.g. `role.realm` → `role_realm`). Filter/sort/field references resolve against the same derivation. |

Relations are validated against the entity metadata of the attached query builder — a requested relation that doesn't exist on the entity is ignored. Joins are applied idempotently: relations already joined on the query builder (by the adapter or by your own code, matched by alias) are skipped, so applying a query twice does not duplicate joins.

::: warning Alias convention
Joins are aliased by the **full relation path**, with `.` replaced by `_`: `realm` joins as alias `realm`, `role.realm` as `role_realm` — the same convention filter/sort/field references resolve against, so same-named relations on different branches never collide. Pre-existing joins are matched by that alias: joins you apply yourself under a different alias (e.g. `role.realm` as `realm`) are not recognized — either use the path-qualified alias or inject your own convention via `relations.relationAlias`. Make sure a custom derivation stays collision-free and within your database's identifier length limit.
:::

## Dialect detection

The adapter resolves the SQL dialect from the attached query builder's connection type (`postgres`, `mysql`/`mariadb`, `sqlite`/`better-sqlite3`, `mssql`, `oracle`, …). Field escaping is delegated to the query builder itself; regex conditions use the matching [dialect preset](/packages/sql#dialects) — on regex-less dialects (SQLite, SQL Server) the `contains` / `startsWith` / `endsWith` operators fall back to `LIKE`, and the `regex` operator throws a typed `AdapterError`. When the connection type has no matching preset, the postgres preset is the documented last-resort default.

## Applying a single parameter

A `Query` with only some parameters set applies just those — the rest are empty and become no-ops. To apply, say, only the filters of a parsed query:

```typescript
import { Query } from '@rapiq/core';

const adapter = new TypeormAdapter({ queryBuilder });
adapter.execute(new Query({ filters: query.filters }));
```

For lower-level control, each per-parameter sub-adapter (`adapter.filters`, `adapter.fields`, `adapter.sort`, `adapter.pagination`, `adapter.relations`) pairs with the matching `@rapiq/sql` visitor (`FiltersVisitor`, `FieldsVisitor`, `SortsVisitor`, `PaginationVisitor`, `RelationsVisitor`) and applies via its own `execute()` — the query builder is already bound from the adapter's construction.

## End-to-end example

The complete Express endpoint — schemas, decoding, error handling, response `meta` — lives in the [Express & TypeORM recipe](/guide/recipes/express-typeorm).

::: info Migrating from typeorm-extension
`applyQuery` used `leftJoinAndSelect` and returned the parsed pagination — `joinType: 'left'` (the default) and the `execute(query)` return value mirror that contract. See the [migration guide](/guide/migration-typeorm-extension).
:::

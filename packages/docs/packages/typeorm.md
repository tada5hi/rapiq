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

Builder state you set before `execute` is preserved: `WHERE` conditions stay (rapiq appends its filter tree with `AND`, and binds its parameters under a private namespace so caller bindings are never rebound), and a query that carries no sorts or pagination leaves a caller-owned `ORDER BY` / `take` / `skip` untouched. An application-owned tenant or authorization predicate therefore remains the baseline even when the client sends no filters. When the client *does* send sorts, fields or pagination, those replace the corresponding builder state — that is the request's job.

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
| `relations.relationAlias` | Derive the join alias for a relation path (default: collision-free length-prefixed segments, e.g. `role.realm` → `r4_role_5_realm`). Filter/sort/field references resolve against the same derivation. |

Relations are validated against the entity metadata of the attached query builder — a requested relation that doesn't exist on the entity is ignored. Joins are applied idempotently: relations already joined on the query builder (by the adapter or by your own code, matched by alias) are skipped, so applying a query twice does not duplicate joins.

::: warning Alias convention
The exported `buildRelationAlias(path)` helper length-prefixes every segment: `realm` becomes `r5_realm`, and `role.realm` becomes `r4_role_5_realm`. This remains distinct even from a relation literally named `role_realm`. Fields, filters, sorts and joins all use the same derivation. Pre-existing joins are matched by that alias; use the helper for joins you apply yourself, or inject one convention via `relations.relationAlias`. Keep a custom derivation collision-free and within your database's identifier length limit.
:::

## Dialect detection

The adapter resolves the SQL dialect from the attached query builder's connection type (`postgres`, `mysql`/`mariadb`, `sqlite`/`better-sqlite3`, `mssql`, `oracle`, …). Field escaping is delegated to the query builder itself; regex conditions use the matching [dialect preset](/packages/sql#dialects) — on regex-less dialects (SQLite, SQL Server) the `contains` / `startsWith` / `endsWith` operators fall back to `LIKE`, and the `regex` operator throws a typed `AdapterError`. When the connection type has no matching preset, the postgres preset is the documented last-resort default.

## Case folding & column types

[Case-insensitive string equality](/guide/filters#case-sensitivity) folds through `lower()` on case-sensitive dialects. The adapter resolves each filtered field against the entity metadata (relation paths included) and folds **only string-typed columns** — filtering an `int` column with an untyped wire string (`filter[age]=18`) renders a plain `=` instead of a `lower(...)` type error, and non-string columns never pay the folding cost. Unresolvable fields keep the folding default; opt fields out explicitly via `execute(query, { visitor: { caseSensitive: [...] } })`.

## Embedded columns

Dotted field paths resolve against the entity metadata segment by segment — only real relations join. A path into an [embedded entity](https://typeorm.io/docs/entity/embedded-entities/) (`@Column(() => Profile)`), e.g. `profile.firstName`, is dotted without anything to join: it renders against its parent alias with the embedded column's database name (`"user"."profileFirstname"`) instead of producing a bogus `LEFT JOIN`. This applies uniformly to filters, sort and field selection, and composes with relations — `role.profile.firstName` joins only `role` and resolves the embedded remainder against that join's alias.

## Deriving schemas from entities

Instead of hand-maintaining a [`Schema`](/guide/schemas) per resource, derive it from the TypeORM entity metadata. `defineSchemaRegistryWithDataSource` walks all entities of a data source and returns a populated `SchemaRegistry` — one schema per entity, cross-linked automatically:

```typescript
import { defineSchemaRegistryWithDataSource } from '@rapiq/typeorm';

const registry = defineSchemaRegistryWithDataSource(dataSource, {
    schemas: {
        user: {
            filters: { allowed: 'inherit' },
            sort: { allowed: 'inherit' },
        },
    },
});
```

Every schema gets its **structure** derived unconditionally: the schema name (lower-camel entity name, `RoleDetail` → `roleDetail`), the allowed relations, and the `schemaMapping` linking each relation to its target entity's schema — so nested paths like `role.detail` resolve across the registry without any manual wiring.

Column-based **allow-lists** are opt-in per parameter: `allowed: 'inherit'` expands to the entity's column property paths. Hidden columns (`select: false`) and virtual join columns are always excluded; explicitly declared FK columns (e.g. `realmId`) are included. Any explicit option wins over its derived counterpart:

```typescript
import { defineSchemaWithEntity } from '@rapiq/typeorm';

const schema = defineSchemaWithEntity(User, dataSource, {
    strict: true,
    fields: { allowed: 'inherit' },
    filters: { allowed: ['id', 'name'] },   // explicit list, nothing derived
    sort: { default: { id: 'DESC' } },
});
```

`defineSchemaWithEntity` also accepts an `EntityMetadata` directly (`defineSchemaWithEntity(dataSource.getMetadata(User))`), and the registry's `schemas` options can be keyed by entity class via a `Map` instead of the derived name. An options key that matches no entity throws, so entity renames fail loudly.

To mix hand-written and derived schemas, pass an existing registry — entities whose derived name is already registered are skipped, so the hand-written schema stays authoritative and derivation fills in the rest:

```typescript
const registry = new SchemaRegistry();
registry.add(userSchema);   // curated by hand

defineSchemaRegistryWithDataSource(dataSource, { registry });
```

Passing `schemas` options for a skipped (already registered) name throws — options that would be silently ignored are treated as a mistake.

Derivation never sets [`strict`](/guide/schemas#strict-mode) — combined with `strict: true`, a derived `allowed: 'inherit'` opens **every** (non-hidden) column to clients, so opt sensitive resources into explicit lists instead.

::: tip
The data source only needs built metadata, not an open connection — deriving schemas at startup before `dataSource.initialize()` completes is fine as long as the metadata was built.
:::

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

# TypeORM

- **Repo**: https://github.com/typeorm/typeorm
- **Used by**: `@rapiq/typeorm` (peer dependency `typeorm@^0.3.28`)

`@rapiq/typeorm` adapts a parsed rapiq `Query` onto TypeORM's `SelectQueryBuilder` without a live database connection.

## Code Mappings

| TypeORM | rapiq | Notes |
|---------|-------|-------|
| `SelectQueryBuilder` (`src/query-builder/SelectQueryBuilder.ts`) | `TypeormAdapter` (`packages/typeorm/src/adapter/module.ts`) | Builder bound at construction (`{ queryBuilder: qb }`); `execute(query)` walks the query and applies the state in one call |
| `RelationMetadata.inverseEntityMetadata` (`src/metadata/RelationMetadata.ts`) | `RelationsAdapter.join()` (`packages/typeorm/src/adapter/relations.ts`) | Metadata of the entity **targeted** by a relation — used to walk nested relation paths. `entityMetadata` is the *owning* entity (using it silently drops nested paths whose segment doesn't also exist on the root entity). |
| `connection.options.type` (`src/data-source/DataSourceOptions.ts`) | `resolveQueryDialect()` (`packages/typeorm/src/dialect.ts`) → `resolveDialect()` (`packages/sql/src/dialect/resolve.ts`) | Connection type name → `DialectOptions` preset; postgres preset is the last-resort fallback. |
| `DataSource.buildMetadatas()` (`src/data-source/DataSource.ts`, protected) | `createUnconnectedDataSource()` (`packages/typeorm/test/data/factory.ts`) | Builds entity metadata without opening a connection — enables dialect specs (incl. `mysql`, needs `mysql2` devDep for driver construction) with no live database. |
| `SelectQueryBuilder.expressionMap.joinAttributes` | `RelationsAdapter.join()` dedup | Pre-existing joins are matched by `joinAttribute.alias.name`; matching joins are skipped (idempotency). |
| `SelectQueryBuilder.andWhere()` + `createWhereExpression()` (`src/query-builder/SelectQueryBuilder.ts`, verified on 0.3.30) | `FiltersAdapter.execute()` (`packages/typeorm/src/adapter/filters.ts`) | `andWhere()` records an `and` clause without clearing `expressionMap.wheres`. During rendering, the first condition is emitted as `WHERE ...` regardless of its stored conjunction; later conditions receive `AND`. The adapter therefore guards empty SQL and uses `andWhere(sql, params)`: a caller-owned tenant/auth predicate is preserved, while a filter on an otherwise empty builder still produces valid SQL. A TypeormAdapter/builder pair remains per-request; re-running onto an already-mutated builder is not a rollback operation. |

<!-- Append new mappings as they are discovered. Include behavioral differences. -->

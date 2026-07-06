# TypeORM

- **Repo**: https://github.com/typeorm/typeorm
- **Used by**: `@rapiq/typeorm` (peer dependency `typeorm@^0.3.28`)

`@rapiq/typeorm` adapts a parsed rapiq `Query` onto TypeORM's `SelectQueryBuilder` without a live database connection.

## Code Mappings

| TypeORM | rapiq | Notes |
|---------|-------|-------|
| `SelectQueryBuilder` (`src/query-builder/SelectQueryBuilder.ts`) | `TypeormAdapter<QUERY extends SelectQueryBuilder>` (`packages/typeorm/src/adapter/module.ts`) | Adapter mutates the builder via `withQuery(qb)` → visit → `execute()` |
| `RelationMetadata.inverseEntityMetadata` (`src/metadata/RelationMetadata.ts`) | `RelationsAdapter.join()` (`packages/typeorm/src/adapter/relations.ts`) | Metadata of the entity **targeted** by a relation — used to walk nested relation paths. `entityMetadata` is the *owning* entity (using it silently drops nested paths whose segment doesn't also exist on the root entity). |
| `connection.options.type` (`src/data-source/DataSourceOptions.ts`) | `resolveQueryDialect()` (`packages/typeorm/src/dialect.ts`) → `resolveDialect()` (`packages/sql/src/dialect/resolve.ts`) | Connection type name → `DialectOptions` preset; postgres preset is the last-resort fallback. |
| `DataSource.buildMetadatas()` (`src/data-source/DataSource.ts`, protected) | `createUnconnectedDataSource()` (`packages/typeorm/test/data/factory.ts`) | Builds entity metadata without opening a connection — enables dialect specs (incl. `mysql`, needs `mysql2` devDep for driver construction) with no live database. |
| `SelectQueryBuilder.expressionMap.joinAttributes` | `RelationsAdapter.join()` dedup | Pre-existing joins are matched by `joinAttribute.alias.name`; matching joins are skipped (idempotency). |

<!-- Append new mappings as they are discovered. Include behavioral differences. -->

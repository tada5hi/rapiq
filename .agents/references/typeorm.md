# TypeORM

- **Repo**: https://github.com/typeorm/typeorm
- **Used by**: `@rapiq/typeorm` (peer dependency `typeorm@^0.3.28`)

`@rapiq/typeorm` adapts a parsed rapiq `Query` onto TypeORM's `SelectQueryBuilder` without a live database connection.

## Code Mappings

| TypeORM | rapiq | Notes |
|---------|-------|-------|
| `SelectQueryBuilder` (`src/query-builder/SelectQueryBuilder.ts`) | `TypeormAdapter<QUERY extends SelectQueryBuilder>` (`packages/typeorm/src/adapter/module.ts`) | Adapter mutates the builder via `withQuery(qb)` → visit → `execute()` |

<!-- Append new mappings as they are discovered. Include behavioral differences. -->

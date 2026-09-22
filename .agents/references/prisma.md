# Prisma engine references

Verified against Prisma 7.10.0 (engine `0edf323efd1d98336f3f0a68684b56f689b900d3`).

| Upstream | Rapiq | Behavior |
|---|---|---|
| `query-compiler/query-builders/sql-query-builder/src/filter/visitor.rs`: `like_contains_pattern`, `like_starts_with_pattern`, `like_ends_with_pattern` | `packages/adapter-prisma/src/adapter/where.ts`: `renderMatch` | Prisma adds LIKE anchors but does not escape the operand or add ESCAPE. Provider `escapeMatch` supplies literal encoding. Measured with generated clients on PostgreSQL and SQLite. |
| `query-engine/connectors/mongodb-query-connector/src/filter.rs`: `regex_match` | `packages/adapter-prisma/src/provider/constants.ts`: MongoDB preset | Prisma interpolates the operand into a regex without escaping; the preset reuses core `createFilterRegexPattern` without anchor flags. |

Source: https://github.com/prisma/prisma-engines/tree/7.10.0

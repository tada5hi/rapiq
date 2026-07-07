# Introduction

Rapiq (**R**est **Api** **Q**uery) is a TypeScript library family to build an efficient interface between client- and server-side applications.
It defines a scheme for the request query — fields, filters, relations, pagination and sort, based on the [JSON:API](https://jsonapi.org/format/) specification — but **not** for the response.

::: warning v2
These docs cover the upcoming **version 2**, which splits the former single `rapiq` package into focused `@rapiq/*` packages.
The v1 documentation lives on the [v1 branch](https://github.com/tada5hi/rapiq/tree/v1).
:::

## How it works

Raw client input is parsed into a typed AST (`Query`), validated against a `Schema`, and consumed by backend adapters via the visitor pattern:

```
Client side                          Server side
-----------                          -----------
Query (AST)
    │
    ▼
URLEncoder (@rapiq/codec-url-simple)
    │  query string
    ▼ ────────────────────────────►  URLDecoder / SimpleParser / ExpressionParser
                                          │  validated against Schema + SchemaRegistry
                                          ▼
                                     Query (AST: Fields, Filters, Pagination, Relations, Sorts)
                                          │  accept(visitor)
                                          ▼
                                     Adapter (@rapiq/sql, @rapiq/typeorm)
                                          │
                                          ▼
                                     SQL fragments / mutated SelectQueryBuilder
```

## Parameters

| Parameter | URL key | Purpose |
|---|---|---|
| `fields` | `fields` | Return only specific resource fields, or extend the default selection. |
| `filters` | `filter` | Filter resources according to specific criteria. |
| `relations` | `include` | Include related resources of the primary resource. |
| `pagination` | `page` | Limit the number of resources returned from the collection. |
| `sort` | `sort` | Sort resources by one or more keys, ascending or descending. |

## Packages

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, visitor interfaces, schema system & registry, parser base classes, errors |
| [@rapiq/parser-simple](/integrations/simple) | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](/integrations/expression) | Parses a function-call expression language (e.g. `and(eq(name, 'John'), gte(age, '18'))`) into a `Query` |
| [@rapiq/codec-url-simple](/integrations/url) | URL query-string encoder & decoder for the simple dialect |
| [@rapiq/codec-url-expression](/integrations/url#expression-dialect) | URL codec for the expression dialect — a nested filter compound in a single `filter=and(...)` parameter |
| [@rapiq/codec-url](/integrations/url#codec-registry) | Registry dispatching between URL codec dialects via the reserved `codec` parameter |
| [@rapiq/sql](/integrations/sql) | Dialect-agnostic SQL adapter; ships presets for Postgres, MySQL, SQLite, MSSQL & Oracle |
| [@rapiq/typeorm](/integrations/typeorm) | Applies a parsed `Query` to a TypeORM `SelectQueryBuilder` |

Everything composes around the core query AST — install only what each side of your application needs.

## Next steps

- [Installation](/getting-started/installation) — add the packages you need.
- [Quick Start](/getting-started/quick-start) — client to database in one walkthrough.
- [Concepts](/guide/) — the Query AST, schemas and visitors in detail.

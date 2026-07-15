# Package Overview

rapiq is a family of small packages around one shared data structure — the [`Query`](/guide/query-ast). Install only what each side of your application needs; `@rapiq/core` is a peer dependency of everything else.

## The map

| Package | Role |
|---|---|
| [@rapiq/core](/packages/core) | Query AST, `defineQuery` + condition helpers, schema system, parser base classes, errors |
| [@rapiq/parser-simple](/packages/parser-simple) | Parses plain object/array input (URL-query-like "simple" dialect) |
| [@rapiq/parser-expression](/packages/parser-expression) | Parses function-call filter expressions (`and(eq(name, 'John'), …)`) |
| [@rapiq/parser-mongo](/packages/parser-mongo) | Parses MongoDB-style filter documents (`{ age: { $gte: 18 } }`) |
| [@rapiq/codec-url](/packages/codec-url) | URL codec façade; writes expressions and reads expression plus legacy simple filters |
| [@rapiq/sql](/packages/sql) | Dialect-agnostic SQL adapter (pg, mysql, sqlite, mssql, oracle presets) |
| [@rapiq/typeorm](/packages/typeorm) | Applies a `Query` to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](/packages/memory) | Evaluates a `Query` against in-memory objects & arrays |

## Which packages do I need?

**A frontend that builds and sends queries:**

```sh
npm install @rapiq/core @rapiq/codec-url
```

**An HTTP API backed by TypeORM:**

```sh
npm install @rapiq/core @rapiq/codec-url @rapiq/sql @rapiq/typeorm
```

**An HTTP API composing SQL by hand:**

```sh
npm install @rapiq/core @rapiq/codec-url @rapiq/sql
```

**Something in-process — guards, tests, mock backends:**

```sh
npm install @rapiq/core @rapiq/memory
```

Then add per feature:

- MongoDB-style filter documents (e.g. JSON bodies) → [@rapiq/parser-mongo](/packages/parser-mongo)
- non-URL canonical object input → [@rapiq/parser-simple](/packages/parser-simple) directly

## Dependency layers

<PackageLayers />

All packages are ESM-only, ship TypeScript types, and share the same export shape (single entry point).

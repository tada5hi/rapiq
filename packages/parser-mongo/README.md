<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/parser-mongo</h1>

<p align="center">
  <b>Parse MongoDB-style filter documents into a rapiq <code>Query</code>.</b><br>
  <code>$and</code> / <code>$or</code> / <code>$nor</code>, <code>$gte</code> / <code>$in</code> / <code>$not</code> / <code>$regex</code>, <code>$elemMatch</code> —<br>
  for clients that submit filters as JSON.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/parser-mongo"><img src="https://img.shields.io/npm/v/@rapiq/parser-mongo/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/parser-mongo"><img src="https://img.shields.io/npm/types/@rapiq/parser-mongo?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/parser-mongo?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/parser-mongo"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/parser-mongo">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq) — typed REST queries: *build, transport, validate, execute.*
Bring a familiar MongoDB-style query document to any rapiq backend — useful when clients submit filters as typed JSON in request bodies or saved queries.

```typescript
{
    $or: [
        { name: 'John', age: { $gte: 18, $lt: 65 } },
        { 'realm.name': { $startsWith: 'mas' } },
    ],
}
```

- 🍃 **Familiar syntax** — `$and` / `$or` / `$nor` compounds, De Morgan `$not` / `$nor` negation, field operators (`$eq`, `$gte`, `$in`, `$regex`, `$elemMatch`, …) and six `$contains`-family rapiq extensions.
- 🔢 **Typed values** — JSON keeps its types (`{ $gte: 18 }` stays a number), no wire-string coercion.
- 🛡️ **Two-class failure model** — grammar errors always throw `FiltersParseError`; field-key/allow-list failures follow the schema drop-vs-throw policy.
- 🔗 **Same AST as every dialect** — only `filters` is mongo-flavoured; fields, relations, pagination and sort reuse `@rapiq/parser-simple`.

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-mongo
```

## Usage

```typescript
import { MongoParser } from '@rapiq/parser-mongo';

const parser = new MongoParser(registry);

const query = parser.parse({
    filters: { age: { $gte: 18 }, 'realm.name': 'master' },
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the mongo dialect — fields, relations, pagination and sort accept the same input as [@rapiq/parser-simple](https://www.npmjs.com/package/@rapiq/parser-simple), and the whole thing returns the same [`Query`](https://rapiq.tada5hi.net/guide/query-ast) AST.

Grammar errors (unknown `$`-operators, misplaced operators, malformed operator arguments) always throw `FiltersParseError`; field keys that fail the schema allow-list are dropped by default and throw when `throwOnFailure` is set.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system — the shared foundation |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| **[@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo)** | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

Full guide (operator table & deviations from MongoDB): [rapiq.tada5hi.net/packages/parser-mongo](https://rapiq.tada5hi.net/packages/parser-mongo)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

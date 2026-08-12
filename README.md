<p align="center">
  <img src=".github/assets/logo.svg" alt="rapiq" width="120">
</p>

<h1 align="center">rapiq</h1>

<p align="center">
  <b>Typed REST queries: build, transport, validate, execute.</b><br>
  Rapiq (<b>R</b>est <b>Api</b> <b>Q</b>uery) builds an efficient interface between applications:<br>
  browser&nbsp;↔&nbsp;API just as well as service&nbsp;↔&nbsp;service. It defines a scheme for the request, but <b>not</b> for the response.
</p>

<p align="center">
  <a href="https://github.com/Tada5hi/rapiq/actions/workflows/main.yml"><img src="https://github.com/Tada5hi/rapiq/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="https://codecov.io/gh/tada5hi/rapiq"><img src="https://codecov.io/gh/tada5hi/rapiq/branch/master/graph/badge.svg?token=QFGCsHRUax" alt="codecov"></a>
  <a href="https://snyk.io/test/github/Tada5hi/rapiq"><img src="https://snyk.io/test/github/Tada5hi/rapiq/badge.svg" alt="Known Vulnerabilities"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white" alt="Conventional Commits"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net"><b>Documentation</b></a>
  ·
  <a href="https://rapiq.tada5hi.net/guide/">Getting Started</a>
  ·
  <a href="https://rapiq.tada5hi.net/guide/">Guide</a>
  ·
  <a href="https://rapiq.tada5hi.net/guide/migration-v1">Migration from v1</a>
</p>

---

> [!NOTE]
> The documentation for v1 (and prior) lives on the [v1 branch](https://github.com/tada5hi/rapiq/tree/v1).

## Why rapiq?

Every REST list endpoint answers the same five questions: which **fields**, which **filters**,
which **relations**, which **page**, which **order**. rapiq turns them into one typed pipeline
instead of ad-hoc string parsing.

- 🧭 **Typed end to end**: every field path in `defineQuery<User>` is checked against the record type; condition helpers (`eq`, `gte`, `and`, `or`, …) replace magic value strings.
- 🛡️ **The receiving side has the last word**: a `Schema` declares what a caller may request per parameter (allow-lists, defaults, mappings). Invalid input is dropped or rejected according to the parser dialect and schema policy, and server conditions (`query.filters.and(...)`) remain conjuncts alongside caller input.
- 🔁 **Loss-free transport**: within each codec dialect, `decode(encode(query))` restores the same query; outside its subset, encoding fails loudly with a typed error instead of silently changing semantics.
- 🔌 **Any backend**: the same AST executes everywhere: parameterized SQL fragments with presets for Postgres, MySQL, SQLite, MSSQL & Oracle, a TypeORM `SelectQueryBuilder`, a Prisma `findMany` args object, a drizzle relational-queries config, or compiled functions over in-memory data.
- 📦 **Composable packages**: no monolith, install only what each side needs; `@rapiq/core` is the single shared foundation.

The two ends are just applications. A browser querying an API is the common case, but services compose the same way:
an API gateway, for instance, validates an incoming query against its own schema, scopes it
(`query.filters.and(...)`) and re-encodes it for the upstream service.

## Usage

One query, from the caller all the way to the database. Both sides share the same record types:

```typescript
type Realm = { id: string, name: string };
type User = { id: number, name: string, email: string, age: number, realm: Realm };
```

### 1. Build 🔧 <sub>calling application</sub>

[`defineQuery`](https://rapiq.tada5hi.net/guide/building-queries) takes typed input and returns a
[Query](https://rapiq.tada5hi.net/guide/query-ast) AST: no magic value strings, every path checked against `User`.

```typescript
import { defineQuery } from '@rapiq/core';
import { createURLCodec } from '@rapiq/codec-url';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { age: { $gte: 18 } },
    relations: ['realm'],
    sorts: '-id',
    pagination: { limit: 20 },
});

await fetch(`/users?${createURLCodec().encode(query)}`);
```

**⬇ over the wire** <sub>self-described, so the receiver knows how to read it</sub>

```
codec=url-expression&fields=id,name&filter=gte(age,'18')&page[limit]=20&include=realm&sort=-id
```

### 2. Validate 🛡️ <sub>receiving application</sub>

A [Schema](https://rapiq.tada5hi.net/guide/schemas) is the allow-list: it decides what a caller may
ask for, per parameter.

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const registry = new SchemaRegistry();

registry.add(defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name'] },
}));

registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sorts: { allowed: ['id', 'name'] },
    pagination: { maxLimit: 20 },
    schemaMapping: { realm: 'realm' },
}));

// accepts a raw query string or a pre-parsed object (express req.query)
const query = createURLCodec(registry).decode(req.query, { schema: 'user' });
```

Anything the schema does not allow never reaches step 3: it is dropped or rejected, per the
schema's failure policy.

**⬇ applied by an adapter**

### 3. Execute 🗄️ <sub>database</sub>

```typescript
import { TypeormAdapter } from '@rapiq/adapter-typeorm';

const adapter = new TypeormAdapter({ queryBuilder, relations: { joinAndSelect: true } });
const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();
```

Values are always bound as parameters, never interpolated into the statement:

```sql
WHERE "user"."age" >= $1        -- params: [18]
ORDER BY "user"."id" DESC
LIMIT 20
```

<details>
<summary><b>The complete Express + TypeORM endpoint</b></summary>

<br>

Assumes [express](https://www.npmjs.com/package/express) and
[typeorm](https://www.npmjs.com/package/typeorm) are installed, with `User` and `Realm` declared as
TypeORM entities and the `registry` from step 2 in scope.

```typescript
import { Request, Response } from 'express';
import { createURLCodec } from '@rapiq/codec-url';
import { TypeormAdapter } from '@rapiq/adapter-typeorm';
// your app's TypeORM DataSource instance
import { dataSource } from './data-source';

const codec = createURLCodec(registry);

/**
 * Get many users.
 *
 * Request example
 * - url: /users?codec=url-expression&page[limit]=10&include=realm&filter=eq(id,'1')&fields=id,name
 */
export async function getUsers(req: Request, res: Response) {
    // map the URL wire names (filter, page, include, ...) to their canonical
    // parameters and validate against the schema allow-lists.
    const query = codec.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end();
    }

    const queryBuilder = dataSource
        .getRepository(User)
        .createQueryBuilder('user');

    const adapter = new TypeormAdapter({
        queryBuilder,
        relations: { joinAndSelect: true },
    });
    const { pagination } = adapter.execute(query);

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

</details>

No TypeORM? The same query runs through [@rapiq/adapter-prisma](packages/adapter-prisma),
[@rapiq/adapter-drizzle](packages/adapter-drizzle),
[@rapiq/adapter-sql](packages/adapter-sql) (parameterized fragments for any driver) or
[@rapiq/adapter-memory](packages/adapter-memory) (plain arrays). Full walkthrough in the
[docs](https://rapiq.tada5hi.net).

## Installation

Version 2 splits the former single `rapiq` package into focused `@rapiq/*` packages, so each side
installs only what it needs. There is **no** `rapiq` umbrella package for v2, and `@rapiq/core` is a
peer dependency of every other package.

```bash
# calling application: build queries, encode them as URL query strings
npm install @rapiq/core @rapiq/codec-url

# receiving application: decode, validate, execute
npm install @rapiq/core @rapiq/codec-url @rapiq/adapter-sql @rapiq/adapter-typeorm
```

Swap the adapters for `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle` or `@rapiq/adapter-memory`
to match your backend.

## Packages

| Package | Purpose |
|---|---|
| [@rapiq/core](packages/core) | Query AST, typed build layer (`defineQuery`, condition helpers, `mergeQueries`), schema system & registry |
| [@rapiq/parser-simple](packages/parser-simple) | Parses plain object/array input (the "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](packages/parser-expression) | Parses filter expressions like `and(eq(name, 'John'), gte(age, '18'))` |
| [@rapiq/parser-mongo](packages/parser-mongo) | Parses MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](packages/codec-url) | URL query-string codec; writes expression filters and reads expression plus legacy simple filters |
| [@rapiq/adapter-sql](packages/adapter-sql) | Dialect-agnostic SQL adapter (pg, mysql, sqlite, mssql & oracle presets) |
| [@rapiq/adapter-typeorm](packages/adapter-typeorm) | Applies a parsed `Query` to a TypeORM `SelectQueryBuilder` |
| [@rapiq/adapter-prisma](packages/adapter-prisma) | Serializes a parsed `Query` into a Prisma argument object |
| [@rapiq/adapter-drizzle](packages/adapter-drizzle) | Serializes a parsed `Query` into a Drizzle relational query config |
| [@rapiq/adapter-memory](packages/adapter-memory) | Evaluates a parsed `Query` against in-memory objects & arrays |

## Parameters

The query scheme is based on the [JSON-API](https://jsonapi.org/format/) specification:

| Parameter | URL name | Description |
|---|---|---|
| `fields` | `fields` | Return only specific resource fields or extend the default selection. |
| `filters` | `filter` | Filter the resources, according to specific criteria. |
| `relations` | `include` | Include related resources of the primary resource. |
| `pagination` | `page` | Limit the number of resources returned from the entire collection. |
| `sorts` | `sort` | Sort the resources according to one or more keys in asc/desc direction. |

## License

Made with 💚

Published under [MIT License](./LICENSE).

<p align="center">
  <img src=".github/assets/logo.svg" alt="rapiq" width="120">
</p>

<h1 align="center">rapiq</h1>

<p align="center">
  <b>Typed REST queries — build, transport, validate, execute.</b><br>
  Rapiq (<b>R</b>est <b>Api</b> <b>Q</b>uery) builds an efficient interface between applications —<br>
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
  <a href="https://rapiq.tada5hi.net/getting-started/">Getting Started</a>
  ·
  <a href="https://rapiq.tada5hi.net/guide/">Guide</a>
  ·
  <a href="https://rapiq.tada5hi.net/guide/migration">Migration from v1</a>
</p>

---

> [!WARNING]
> This README includes the documentation for the upcoming version 2.
>
> This is the [link](https://github.com/tada5hi/rapiq/tree/v1) for the v1 (and prior).

## Why rapiq?

Every REST list endpoint answers the same five questions: which **fields**, which **filters**, which **relations**, which **page**, which **order**. rapiq turns them into one typed pipeline instead of ad-hoc string parsing:

| Stage | What happens |
|---|---|
| **Build** <sub>calling application</sub> | `defineQuery<User>({ filters: { age: gte(18) }, sort: '-name' })` — typed input in, query AST out |
| **Transport** <sub>wire</sub> | encoded as a JSON-API-style query string: `?filter[age]=>=18&sort=-name` |
| **Validate** <sub>receiving application</sub> | decoded back into the same AST, checked against a `Schema` — allow-lists, defaults, mappings |
| **Execute** <sub>database</sub> | applied as parameterized SQL (`@rapiq/sql`) or to a TypeORM `SelectQueryBuilder` (`@rapiq/typeorm`) |

The two ends are just applications. A browser querying an API is the common case, but services compose the same way —
an API gateway, for instance, validates an incoming query against its own schema, scopes it
(`query.filters.and(...)`) and re-encodes it for the upstream service.

- 🧭 **Typed end to end** — every field path in `defineQuery<User>` is checked against the record type; condition helpers (`eq`, `gte`, `and`, `or`, …) replace magic value strings.
- 🛡️ **The receiving side has the last word** — a `Schema` declares what a caller may request per parameter (allow-lists, defaults, mappings). Anything outside it is dropped — or throws, opt-in — and injected conditions (`query.filters.and(...)`) can't be displaced by caller input.
- 🔁 **Loss-free transport** — within each codec dialect, `decode(encode(query))` restores the same query; outside its subset, encoding fails loudly with a typed error instead of silently changing semantics.
- 🔌 **Any backend** — the AST is consumed through visitors: parameterized SQL fragments with presets for Postgres, MySQL, SQLite, MSSQL & Oracle, or applied straight to a TypeORM `SelectQueryBuilder`.
- 📦 **Composable packages** — no monolith: install only what each side needs; `@rapiq/core` is the single shared foundation.

## Installation

Version 2 splits the former single `rapiq` package into focused, composable `@rapiq/*` packages —
there is **no** `rapiq` umbrella package for v2, install only what you need
(see [Packages](#packages) below; `@rapiq/core` is a peer dependency of every other package).

Querying application — build queries and encode them as URL query strings:

```bash
npm install @rapiq/core @rapiq/codec-url-simple
```

Queried application — decode & validate incoming query input and apply it to the database:

```bash
npm install @rapiq/core @rapiq/codec-url-simple @rapiq/sql @rapiq/typeorm
```

## Usage

A small outlook on how to use the library. For detailed explanations and extended examples,
read the [docs](https://rapiq.tada5hi.net).

### Build 🔧

The first step is to build a [Query](https://rapiq.tada5hi.net/guide/query) for a generic Record `<T>` with
[defineQuery](https://rapiq.tada5hi.net/guide/build) — typed input in, AST out, no magic value strings.
Filters accept scalars, arrays (`null` is a legal element), `$`-operator objects and
[condition helpers](https://rapiq.tada5hi.net/guide/build#condition-helpers) (`eq`, `gte`, `and`, `or`, …);
queries compose with [mergeQueries](https://rapiq.tada5hi.net/guide/merge).

The query is serialized for transport by the URL codec (`@rapiq/codec-url-simple`) and decoded back
into the same AST on the receiving side.

```typescript
import { defineQuery } from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

export type Realm = {
    id: string,
    name: string,
    description: string,
}

export type Item = {
    id: string,
    realm: Realm,
    user: User
}

export type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: Item[]
}

const query = defineQuery<User>({
    pagination: {
        limit: 20,
        offset: 10
    },
    filters: {
        id: 1
    },
    fields: ['id', 'name'],
    sort: '-id',
    relations: ['realm']
});

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[id]=1&page[limit]=20&page[offset]=10&include=realm&sort=-id

const response = await fetch(`/users?${queryString}`);
```

### Parse 🔎

On the receiving side the incoming query is decoded back into the same
[Query](https://rapiq.tada5hi.net/guide/query) AST. A
[Schema](https://rapiq.tada5hi.net/guide/schema) declares what a caller may request per parameter
(allow-lists, defaults, mappings) — anything outside it is silently dropped
(set `throwOnFailure: true` on the schema to get a `ParseError` instead).
The decoded query is then applied to the database by an adapter
([@rapiq/typeorm](https://rapiq.tada5hi.net/integrations/typeorm) below;
[@rapiq/sql](https://rapiq.tada5hi.net/integrations/sql) renders parameterized SQL fragments for any other driver).

The following example assumes [express](https://www.npmjs.com/package/express) and
[typeorm](https://www.npmjs.com/package/typeorm) are installed, and uses the same
`User` & `Realm` types as the build example, declared as TypeORM entities.

```typescript
import { Request, Response } from 'express';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { URLDecoder } from '@rapiq/codec-url-simple';
import { TypeormAdapter } from '@rapiq/typeorm';
// your app's TypeORM DataSource instance
import { dataSource } from './data-source';

const registry = new SchemaRegistry();

registry.add(defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name'] },
}));

registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['items', 'realm'] },
    pagination: { maxLimit: 20 },
    sort: { allowed: ['id', 'name'] },
    schemaMapping: { realm: 'realm' },
}));

const decoder = new URLDecoder(registry);

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=realm&filter[id]=1&fields=id,name
 *
 * @param req
 * @param res
 */
export async function getUsers(req: Request, res: Response) {
    // map the URL wire names (filter, page, include, ...) to their canonical
    // parameters and validate against the schema allow-lists.
    const query = decoder.decode(req.query, { schema: 'user' });
    if (!query) {
        return res.status(400).end();
    }

    const queryBuilder = dataSource
        .getRepository(User)
        .createQueryBuilder('user');

    const adapter = new TypeormAdapter({
        target: queryBuilder,
        relations: { joinAndSelect: true }
    });
    const { pagination } = adapter.execute(query);

    const [entities, total] = await queryBuilder.getManyAndCount();

    return res.json({
        data: entities,
        meta: {
            total,
            limit: pagination.limit,
            offset: pagination.offset
        }
    });
}
```

## Packages

| Package | Purpose |
|---|---|
| [@rapiq/core](packages/core) | Query AST, typed build layer (`defineQuery`, condition helpers, `mergeQueries`), schema system & registry |
| [@rapiq/parser-simple](packages/parser-simple) | Parses plain object/array input (the "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](packages/parser-expression) | Parses filter expressions like `and(eq(name, 'John'), gte(age, '18'))` |
| [@rapiq/parser-mongo](packages/parser-mongo) | Parses MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url-simple](packages/codec-url-simple) | URL query-string encoder & decoder for the simple dialect |
| [@rapiq/codec-url-expression](packages/codec-url-expression) | URL codec carrying nested filter compounds in a single `filter=and(...)` parameter |
| [@rapiq/codec-url](packages/codec-url) | Registry dispatching between URL codec dialects via the reserved `codec` parameter |
| [@rapiq/sql](packages/sql) | Dialect-agnostic SQL adapter (pg, mysql, sqlite, mssql & oracle presets) |
| [@rapiq/typeorm](packages/typeorm) | Applies a parsed `Query` to a TypeORM `SelectQueryBuilder` |
| [@rapiq/memory](packages/memory) | Evaluates a parsed `Query` against in-memory objects & arrays |

## Parameters

The query scheme is based on the [JSON-API](https://jsonapi.org/format/) specification:

| Parameter | URL name | Description |
|---|---|---|
| `fields` | `fields` | Return only specific resource fields or extend the default selection. |
| `filters` | `filter` | Filter the resources, according to specific criteria. |
| `relations` | `include` | Include related resources of the primary resource. |
| `pagination` | `page` | Limit the number of resources returned from the entire collection. |
| `sort` | `sort` | Sort the resources according to one or more keys in asc/desc direction. |

## License

Made with 💚

Published under [MIT License](./LICENSE).

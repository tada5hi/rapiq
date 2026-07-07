# rapiq 🌈

[![npm version](https://badge.fury.io/js/rapiq.svg)](https://badge.fury.io/js/rapiq)
[![main](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/tada5hi/rapiq/branch/master/graph/badge.svg?token=QFGCsHRUax)](https://codecov.io/gh/tada5hi/rapiq)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/rapiq/badge.svg)](https://snyk.io/test/github/Tada5hi/rapiq)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

> [!WARNING]
> This README includes the documentation for the upcoming version 2.
>
> This is the [link](https://github.com/tada5hi/rapiq/tree/v1) for the v1 (and prior).

Rapiq (**R**est **Api** **Q**uery) is a library to build an efficient interface between client- & server-side applications.
It defines a scheme for the request, but **not** for the response.

**Table of Contents**

- [Packages](#packages)
- [Installation](#installation)
- [Documentation](#documentation)
- [Parameters](#parameters)
- [Usage](#usage)
- [License](#license)

## Packages

Version 2 splits the former single `rapiq` package into focused, composable `@rapiq/*` packages —
there is **no** `rapiq` umbrella package for v2, install only what you need
(`@rapiq/core` is a peer dependency of every other package):

| Package | Purpose |
|---|---|
| [@rapiq/core](packages/core) | Query AST, typed build layer (`defineQuery`, condition helpers, `mergeQueries`), schema system & registry |
| [@rapiq/parser-simple](packages/parser-simple) | Parses plain object/array input (the "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](packages/parser-expression) | Parses filter expressions like `and(eq(name, 'John'), gte(age, '18'))` |
| [@rapiq/codec-url-simple](packages/codec-url-simple) | URL query-string encoder & decoder for the simple dialect |
| [@rapiq/codec-url-expression](packages/codec-url-expression) | URL codec carrying nested filter compounds in a single `filter=and(...)` parameter |
| [@rapiq/codec-url](packages/codec-url) | Registry dispatching between URL codec dialects via the reserved `codec` parameter |
| [@rapiq/sql](packages/sql) | Dialect-agnostic SQL adapter (pg, mysql, sqlite, mssql & oracle presets) |
| [@rapiq/typeorm](packages/typeorm) | Applies a parsed `Query` to a TypeORM `SelectQueryBuilder` |

## Installation

Client side — build queries and encode them as URL query strings:

```bash
npm install @rapiq/core @rapiq/codec-url-simple
```

Server side — decode & validate incoming query input and apply it to the database:

```bash
npm install @rapiq/core @rapiq/codec-url-simple @rapiq/sql @rapiq/typeorm
```

## Documentation

To read the docs, visit [https://rapiq.tada5hi.net](https://rapiq.tada5hi.net)

## Parameters

- `fields`
    - Description: Return only specific resource fields or extend the default selection.
    - URL-Parameter: **fields**
- `filters`
    - Description: Filter the resources, according to specific criteria.
    - URL-Parameter: **filter**
- `relations`
    - Description: Include related resources of the primary resource.
    - URL-Parameter: **include**
- `pagination`
    - Description: Limit the number of resources returned from the entire collection.
    - URL-Parameter: **page**
- `sort`
    - Description: Sort the resources according to one or more keys in asc/desc direction.
    - URL-Parameter: **sort**

It is based on the [JSON-API](https://jsonapi.org/format/) specification.

## Usage

This is a small outlook on how to use the library. For detailed explanations and extended examples,
read the [docs](https://rapiq.tada5hi.net).

### Build 🔧

The first step is to build a [Query](https://rapiq.tada5hi.net/guide/query) for a generic Record `<T>` with
[defineQuery](https://rapiq.tada5hi.net/guide/build) — typed input in, AST out, no magic value strings.
Filters accept scalars, arrays (`null` is a legal element), `$`-operator objects and
[condition helpers](https://rapiq.tada5hi.net/guide/build#condition-helpers) (`eq`, `gte`, `and`, `or`, …);
queries compose with [mergeQueries](https://rapiq.tada5hi.net/guide/merge).

The query is serialized for transport by the URL codec (`@rapiq/codec-url-simple`) and parsed back
into the same AST on the server side.

#### Example

```typescript
import axios from 'axios';
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

type ResponsePayload = {
    data: User[],
    meta: {
        limit: number,
        offset: number,
        total: number
    }
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

// console.log(encoder.encode(query));
// fields=id,name&filter[id]=1&page[limit]=20&page[offset]=10&include=realm&sort=-id

async function getAPIUsers(): Promise<ResponsePayload> {
    const response = await axios.get(`users?${encoder.encode(query)}`);

    return response.data;
}

(async () => {
    let response = await getAPIUsers();

    // do something with the response :)
})();
```

The next [section](#parse-) will describe, how to parse the query string on the backend side.

### Parse 🔎

On the server side the incoming query is decoded back into the same
[Query](https://rapiq.tada5hi.net/guide/query) AST. A
[Schema](https://rapiq.tada5hi.net/guide/schema) declares what a client may request per parameter
(allow-lists, defaults, mappings) — anything outside it is silently dropped
(set `throwOnFailure: true` on the schema to get a `ParseError` instead).
The decoded query is then applied to the database by an adapter
([@rapiq/typeorm](https://rapiq.tada5hi.net/integrations/typeorm) below;
[@rapiq/sql](https://rapiq.tada5hi.net/integrations/sql) renders parameterized SQL fragments for any other driver).

#### Example

The following example is based on the assumption, that the following packages are installed:
- [express](https://www.npmjs.com/package/express)
- [typeorm](https://www.npmjs.com/package/typeorm)

It uses the same `User` & `Realm` types as the build example, declared as TypeORM entities.

```typescript
import { Request, Response } from 'express';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { URLDecoder } from '@rapiq/codec-url-simple';
import { QueryVisitor } from '@rapiq/sql';
import { TypeormAdapter } from '@rapiq/typeorm';

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
        relations: { joinAndSelect: true }
    });
    adapter.withQuery(queryBuilder);
    query.accept(new QueryVisitor(adapter));
    const { pagination } = adapter.execute();

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

## License

Made with 💚

Published under [MIT License](./LICENSE).

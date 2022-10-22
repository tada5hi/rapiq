# rapiq 🌈

[![npm version](https://badge.fury.io/js/rapiq.svg)](https://badge.fury.io/js/rapiq)
[![main](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/tada5hi/rapiq/branch/master/graph/badge.svg?token=QFGCsHRUax)](https://codecov.io/gh/tada5hi/rapiq)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/rapiq/badge.svg)](https://snyk.io/test/github/Tada5hi/rapiq)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Rapiq (**R**est **Api** **Q**uery) is a library to build an efficient interface between client- & server-side applications.
It defines a scheme for the request, but **not** for the response.

**Table of Contents**

- [Installation](#installation)
- [Documentation](#documentation)
- [Parameters](#parameters)
- [Usage](#usage)
- [License](#license)

## Installation

```bash
npm install rapiq --save
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

The first step is to construct a [BuildInput](https://rapiq.tada5hi.net/guide/build-api-reference#buildinput) object for a generic Record `<T>`.
Pass the object to the [buildQuery](https://rapiq.tada5hi.net/guide/build-api-reference#buildquery) method to convert it to a transportable string.

The `BuildInput<T>` can contain a configuration for each
[Parameter](https://rapiq.tada5hi.net/guide/parameter-api-reference.md#parameter)/
[URLParameter](https://rapiq.tada5hi.net/guide/parameter-api-reference.md#urlparameter).
- [Fields](https://rapiq.tada5hi.net/guide/fields-api-reference.md#fieldsbuildinput): `FieldsBuildInput<T>`
- [Filter(s)](https://rapiq.tada5hi.net/guide/filters-api-reference.md#filtersbuildinput): `FiltersBuildInput<T>`
- [Pagination](https://rapiq.tada5hi.net/guide/pagination-api-reference.md#paginationbuildinput): `PaginationBuildInput<T>`
- [Relations](https://rapiq.tada5hi.net/guide/relations-api-reference.md#relationsbuildinput): `RelationsBuildInput<T>`
- [Sort](https://rapiq.tada5hi.net/guide/sort-api-reference.md#sortbuildinput): `SortBuildInput<T>`

> **NOTE**: Check out the API-Reference of each parameter for acceptable input formats and examples.

After building, the string can be passed to a backend application as http query string argument.
The backend application can process the request, by [parsing](https://rapiq.tada5hi.net/guide/parse.md) the query string.

#### Example

The following example is based on the assumption, that the following packages are installed:
- [express](https://www.npmjs.com/package/express)
- [typeorm](https://www.npmjs.com/package/typeorm)
- [typeorm-extension](https://www.npmjs.com/package/typeorm-extension)

It should give an insight on how to use this library.
Therefore, a type which will represent a `User` and a method `getAPIUsers` are defined.
The method should perform a request to the resource API to receive a collection of entities.

```typescript
import axios from "axios";
import {
    buildQuery,
    BuildInput
} from "rapiq";

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

const record: BuildInput<User> = {
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
};

const query = buildQuery(record);
// console.log(query);
// ?filter[id]=1&fields=id,name&page[limit]=20&page[offset]=10&sort=-id&include=realm

async function getAPIUsers(
    record: BuildInput<User>
): Promise<ResponsePayload> {
    const response = await axios.get('users' + buildQuery(record));

    return response.data;
}

(async () => {
    let response = await getAPIUsers(record);

    // do something with the response :)
})();
```

The next [section](#parse-) will describe, how to parse the query string on the backend side.

### Parse 🔎

The last step of the whole process is to parse the transpiled query string, to an efficient data structure.
The result object (`ParseOutput`) can contain an output for each
[Parameter](https://rapiq.tada5hi.net/guide/parameter-api-reference.md#parameter)/
[URLParameter](https://rapiq.tada5hi.net/guide/parameter-api-reference.md#urlparameter).
- [Fields](https://rapiq.tada5hi.net/guide/fields-api-reference.md#fieldsparseoutput): `FieldsParseOutput<T>`
- [Filter(s)](https://rapiq.tada5hi.net/guide/filters-api-reference.md#filtersparseoutput): `FiltersParseOutput<T>`
- [Pagination](https://rapiq.tada5hi.net/guide/pagination-api-reference.md#paginationparseoutput): `PaginationParseOutput<T>`
- [Relations](https://rapiq.tada5hi.net/guide/relations-api-reference.md#relationsparseoutput): `RelationsParseOutput<T>`
- [Sort](https://rapiq.tada5hi.net/guide/sort-api-reference.md#sortparseoutput): `SortParseOutput<T>`

> **NOTE**: Check out the API-Reference of each parameter for output formats and examples.

#### Example

The following example is based on the assumption, that the following packages are installed:
- [express](https://www.npmjs.com/package/express)
- [typeorm](https://www.npmjs.com/package/typeorm)
- [typeorm-extension](https://www.npmjs.com/package/typeorm-extension)

For explanation purposes, three simple entities with relations between them are declared to demonstrate
the usage on the backend side.

**`entities.ts`**
```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    JoinColumn,
    ManyToOne
} from "typeorm";

@Entity()
export class User {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 30})
    @Index({unique: true})
    name: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    email: string;

    @Column({type: 'int', nullable: true})
    age: number

    @ManyToOne(() => Realm, { onDelete: 'CASCADE' })
    realm: Realm;

    @OneToMany(() => User, { onDelete: 'CASCADE' })
    items: Item[];
}

@Entity()
export class Realm {
    @PrimaryColumn({ type: 'varchar', length: 36 })
    id: string;

    @Column({ type: 'varchar', length: 128, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true, default: null })
    description: string | null;
}

@Entity()
export class Item {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @ManyToOne(() => Realm, { onDelete: 'CASCADE' })
    realm: Realm;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;
}
```

```typescript
import { Request, Response } from 'express';

import {
    applyQuery,
    useDataSource
} from 'typeorm-extension';

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
    const dataSource = await useDataSource();
    const repository = dataSource.getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    // parse and apply data on the db query.
    const { pagination } = applyQuery(query, req.query, {
        defaultPath: 'user',
        fields: {
            allowed: ['id', 'name', 'realm.id', 'realm.name'],
        },
        filters: {
            allowed: ['id', 'name', 'realm.id'],
        },
        relations: {
            allowed: ['items', 'realm']
        },
        pagination: {
            maxLimit: 20
        },
        sort: {
            allowed: ['id', 'name', 'realm.id'],
        }
    });

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return res.json({
        data: {
            data: entities,
            meta: {
                total,
                ...pagination
            }
        }
    });
}
```

## License

Made with 💚

Published under [MIT License](./LICENSE).

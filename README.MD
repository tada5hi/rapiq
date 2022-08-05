# rapiq 🌈

[![main](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/rapiq/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/tada5hi/rapiq/branch/master/graph/badge.svg?token=QFGCsHRUax)](https://codecov.io/gh/tada5hi/rapiq)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/rapiq/badge.svg)](https://snyk.io/test/github/Tada5hi/rapiq)
[![npm version](https://badge.fury.io/js/rapiq.svg)](https://badge.fury.io/js/rapiq)

Rapiq (**R**est **Api** **Q**uery) is a library to build an efficient interface between client- & server-side applications.
It defines a format for the request, but **not** for the response.

**Table of Contents**

- [Installation](#installation)
- [Documentation](#documentation)
- [Parameters](#parameters)
- [Usage](#usage)

## Installation

```bash
npm install rapiq --save
```
## Documentation

To read the docs, visit [https://rapiq.tada5hi.net](https://rapiq.tada5hi.net)

## Parameters
- `fields`
    - Description: Return only specific fields or extend the default selection.
    - URL-Parameter: **fields**
- `filters`
    - Description: Filter the data set, according to specific criteria.
    - URL-Parameter: **filter**
- `relations`
    - Description: Include related resources of the primary data.
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

### Build 🏗

The first step is to construct a [BuildInput](https://rapiq.tada5hi.net/guide/build-api-reference.html#buildinput) object for a generic Record `<T>` and
pass it to the [buildQuery](https://rapiq.tada5hi.net/guide/build-api-reference.html#buildquery) method to convert it to a string.

The result string can then be provided as a URL query string to a backend application.
The backend application can than process the request, by [parsing](#parse-) the query string.

The following example should give an insight on how to use this library.
Therefore, a type which will represent a `User` and a method `getAPIUsers` are defined.
The method should perform a request to the resource API to receive a collection of entities.

```typescript
import axios from "axios";
import {
    buildQuery,
    BuildInput
} from "rapiq";

type Profile = {
    id: number;
    avatar: string;
    cover: string;
}

type User = {
    id: number;
    name: string;
    age?: number;
    profile: Profile;
}

type ResponsePayload = {
    data: User[],
    meta: {
        limit: number,
        offset: number,
        total: number
    }
}

export async function getAPIUsers(
    record: BuildInput<User>
): Promise<ResponsePayload> {
    const response = await axios.get('users' + buildQuery(record));

    return response.data;
}

(async () => {
    const record: BuildInput<User> = {
        pagination: {
            limit: 20,
            offset: 10
        },
        filters: {
            id: 1 // some possible values:
            // 1 | [1,2,3] | '!1' | '~1' | ['!1',2,3] | {profile: {avatar: 'xxx.jpg'}}
        },
        fields: ['id', 'name'], // some possible values:
        // 'id' | ['id', 'name'] | '+id' | {user: ['id', 'name'], profile: ['avatar']}
        sort: '-id', // some possible values:
        // 'id' | ['id', 'name'] | '-id' | {id: 'DESC', profile: {avatar: 'ASC'}}
        relations: {
            profile: true
        }
    };

    const query = buildQuery(record);

    // console.log(query);
    // ?filter[id]=1&fields=id,name&page[limit]=20&page[offset]=10&sort=-id&include=profile

    let response = await getAPIUsers(record);

    // do something with the response :)
})();
```

The next [section](#parse-) will describe, how to parse the query string on the backend side.

### Parse 🔎

For explanation purposes, two simple entities with a basic relation between them are declared to demonstrate
the usage on the backend side.
Therefore, [typeorm](https://typeorm.io/) is used as ORM for the database.

**`entities.ts`**
```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn
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

    @OneToOne(() => Profile)
    profile: Profile;
}

@Entity()
export class Profile {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    avatar: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    cover: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User;
}
```

```typescript
import { Request, Response } from 'express';

import {
    parseQuery,
    Parameter,
    ParseOutput
} from 'rapiq';

import {
    applyQueryParseOutput,
    useDataSource
} from 'typeorm-extension';

/**
 * Get many users.
 *
 * ...
 *
 * @param req
 * @param res
 */
export async function getUsers(req: Request, res: Response) {
    // const {fields, filter, include, page, sort} = req.query;

    const output: ParseOutput = parseQuery(req.query, {
        fields: {
            defaultAlias: 'user',
            allowed: ['id', 'name', 'profile.id', 'profile.avatar']
        },
        filters: {
            defaultAlias: 'user',
            allowed: ['id', 'name', 'profile.id']
        },
        relations: {
            allowed: ['profile']
        },
        pagination: {
            maxLimit: 20
        },
        sort: {
            defaultAlias: 'user',
            allowed: ['id', 'name', 'profile.id']
        }
    });

    const dataSource = await useDataSource();
    const repository = dataSource.getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    // apply parsed data on the db query.
    const parsed = applyQueryParseOutput(query, output);

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return res.json({
        data: {
            data: entities,
            meta: {
                total,
                ...output.pagination
            }
        }
    });
}
```

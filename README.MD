# rapiq 🌈

[![npm version](npm install rapiq --save- [Fields](https://rapiq.tada5hi.net/guide/fields-api-reference.md#fieldsbuildinput): `FieldsBuildInput<T>`
- [Filter(s)](https://rapiq.tada5hi.net/guide/filters-api-reference.md#filtersbuildinput): `FiltersBuildInput<T>`
- [Pagination](https://rapiq.tada5hi.net/guide/pagination-api-reference.md#paginationbuildinput): `PaginationBuildInput<T>`
- [Relations](https://rapiq.tada5hi.net/guide/relations-api-reference.md#relationsbuildinput): `RelationsBuildInput<T>`
- [Sort](https://rapiq.tada5hi.net/guide/sort-api-reference.md#sortbuildinput): `SortBuildInput<T>`

> [!NOTE]
> Check out the API-Reference of each parameter for acceptable input formats and examples.

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
import { builder } from 'rapiq';

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

const data = builder<User>({
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

// console.log(builder.toString());
// ?filter[id]=1&fields=id,name&page[limit]=20&page[offset]=10&sort=-id&include=realm

async function getAPIUsers(
    builder: Builder<User>
): Promise<ResponsePayload> {
    const response = await axios.get(`users${data.toString()}`);

    return response.data;
}

(async () => {
    let response = await getAPIUsers(data);

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

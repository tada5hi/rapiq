# Parse 🔎

The last step of the whole process is to parse the transpiled query string, to an efficient data structure.
The result object (`ParseOutput`) can contain an output for each
[Parameter](parameter-api-reference.md#parameter)/[URLParameter](parameter-api-reference.md#urlparameter).
- [Fields](fields-api-reference.md#fieldsparseoutput): `FieldsParseOutput<T>`
- [Filter(s)](filters-api-reference.md#filtersparseoutput): `FiltersParseOutput<T>`
- [Pagination](pagination-api-reference.md#paginationparseoutput): `PaginationParseOutput<T>`
- [Relations](relations-api-reference.md#relationsparseoutput): `RelationsParseOutput<T>`
- [Sort](sort-api-reference.md#sortparseoutput): `SortParseOutput<T>`

::: tip
Check out the API-Reference of each parameter for output formats and examples.
:::

## Example

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

## Extended Example

In the following code snippet, all query parameter parse functions (`parseQueryFields`, `parseQueryFilters`, ...)
will be imported separately, to show the usage in detail.

```typescript
import {Request, Response} from 'express';

import {
    parseQueryFields,
    parseQueryFilters,
    parseQueryRelations,
    parseQueryPagination,
    parseQuerySort,
    Parameter
} from "rapiq";

import {
    applyQueryParseOutput,
    useDataSource
} from 'typeorm-extension';

import { User } from './entities';

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=realm&filter[id]=1&fields=id,name
 *
 * Return Example:
 * {
 *     data: [
 *         {
 *              id: 1, 
 *              name: 'tada5hi', 
 *              realm: {
 *                  id: 'xxx', 
 *                  name: 'xxx'
 *              }
 *         }
 *      ],
 *     meta: {
 *        total: 1,
 *        limit: 20,
 *        offset: 0
 *    }
 * }
 * @param req
 * @param res
 */
export async function getUsers(req: Request, res: Response) {
    const {fields, filter, include, page, sort} = req.query;

    const dataSource = await useDataSource();
    const repository = dataSource.getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------
    
    const parsed = applyQueryParseOutput(query, {
        defaultPath: 'user',
        fields: parseQueryFields(fields, {
            defaultPath: 'user',
            // The fields id & name of the realm entity can only be used, 
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id', 'realm.name'],
            relations: relationsParsed
        }),
        // only allow filtering users by id & name
        filters: parseQueryFilters(filter, {
            defaultPath: 'user',
            // realm.id can only be used as filter key, 
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id'],
            relations: relationsParsed
        }),
        relations: parseQueryRelations(include, {
            allowed: ['items', 'realm']
        }),
        // only allow to select 20 items at maximum.
        pagination: parseQueryPagination(page, {
            maxLimit: 20
        }),
        sort: parseQuerySort(sort, {
            defaultPath: 'user',
            // profile.id can only be used as sorting key,
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id'],
            relations: relationsParsed
        })
    });

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return res.json({
        data: {
            data: entities,
            meta: {
                total,
                ...parsed.pagination
            }
        }
    });
}
```

## Simple Example

Another way is to directly import the [parseQuery](parse-api-reference#parsequery) method, which will handle a group of query parameter values & options.
The [ParseInput](parse-api-reference#parseinput) argument of the `parseQuery` method accepts multiple (alias-) property keys.

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

## Third Party Support

It can even be much simpler to parse the query key-value pairs with the `typeorm-extension` library, because it
uses this library under the hood ⚡.
This is much shorter than the previous example and has less explicit dependencies 😁.

[read more](https://www.npmjs.com/package/typeorm-extension)

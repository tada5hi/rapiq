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

## Separate

The following variant will `parse` and `apply` the query parameters in **two** steps.

After the [ParseOutput](parse-api-reference.md#parseoutput) is generated using the [parseQuery](parse-api-reference.md#parsequery) function, 
the output can be applied on the typeorm QueryBuilder using the `applyQueryParseOutput` function of 
the [typeorm-extension](https://www.npmjs.com/package/typeorm-extension).

```typescript
import { Request, Response } from 'express';

import {
    parseQuery,
    ParseOutput
} from 'rapiq';

import {
    applyQueryParseOutput,
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
    const output: ParseOutput = parseQuery<User>(req.query, {
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
    applyQueryParseOutput(query, output);

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

## Compact

Another way is to use the `applyQuery` function which will `parse` and `apply` the query parameters in **one** step.

This is much shorter than the previous example and has less explicit dependencies ⚡.

```typescript
import {Request, Response} from 'express';

import {
    applyQuery,
    useDataSource
} from 'typeorm-extension';

import { User } from './entities';

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
    
    const { pagination } = applyQuery(query, req.query, {
        // defaultAlais is an alias for the defaultPath option
        defaultAlias: 'user',
        fields: {
            // The fields id & name of the realm entity can only be used, 
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id', 'realm.name']
        },
        // only allow filtering users by id & name
        filters: {
            // realm.id can only be used as filter key, 
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id']
        },
        relations: {
            allowed: ['items', 'realm']
        },
        // only allow to select 20 items at maximum.
        pagination: {
            maxLimit: 20
        },
        sort: {
            // profile.id can only be used as sorting key,
            // if the relation 'realm' is included.
            allowed: ['id', 'name', 'realm.id']
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

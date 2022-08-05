# Parse 🔎
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
} from "hapiq";

import {
    applyQueryParseOutput,
    useDataSource
} from 'typeorm-extension';

import { User } from './entities';

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=profile&filter[id]=1&fields[user]=id,name
 *
 * Return Example:
 * {
 *     data: [
 *         {id: 1, name: 'tada5hi', profile: {avatar: 'avatar.jpg', cover: 'cover.jpg'}}
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

    const relationsParsed = parseQueryRelations(include, {
        allowed: 'profile'
    });

    const fieldsParsed = parseQueryFields(fields, {
        defaultAlias: 'user',
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        relations: relationsParsed
    });

    const filterParsed = parseQueryFilters(filter, {
        defaultAlias: 'user',
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        allowed: ['id', 'name', 'profile.id'],
        relations: relationsParsed
    });

    const pageParsed = parseQueryPagination(page, {
        maxLimit: 20
    });

    const sortParsed = parseQuerySort(sort, {
        defaultAlias: 'user',
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        allowed: ['id', 'name', 'profile.id'],
        relations: relationsParsed
    });

    // -----------------------------------------------------

    // group back parsed parameter back,
    // so they can applied on the db query.
    const parsed = applyQueryParseOutput(query, {
        fields: fieldsParsed,
        // only allow filtering users by id & name
        filters: filterParsed,
        relations: relationsParsed,
        // only allow to select 20 items at maximum.
        pagination: pageParsed,
        sort: sortParsed
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
} from 'hapiq';

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

## Third Party Support

It can even be much simpler to parse the query key-value pairs with the `typeorm-extension` library, because it
uses this library under the hood ⚡.
This is much shorter than the previous example and has less explicit dependencies 😁.

[read more](https://www.npmjs.com/package/typeorm-extension)

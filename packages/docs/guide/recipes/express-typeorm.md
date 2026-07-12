# REST API with Express & TypeORM

The complete, production-shaped list endpoint: schemas in one module, a decoder shared across handlers, per-request adapters, a `meta` block in the response and clean `400`s for contract violations.

## Project layout

```
src/
├── schema.ts        # schemas + registry (one place for the whole contract)
├── decoder.ts       # shared URLDecoder
└── routes/users.ts  # the endpoint
```

## 1. The contract

```typescript
// src/schema.ts
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { Realm, User } from './entities';

export const registry = new SchemaRegistry();

registry.add(defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name'] },
    filters: { allowed: ['id', 'name'] },
}));

registry.add(defineSchema<User>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email', 'age'],
        default: ['id', 'name'],
    },
    filters: { allowed: ['id', 'name', 'age', 'realm.id'] },
    relations: { allowed: ['realm'] },
    sort: {
        allowed: ['id', 'name', 'age'],
        default: { id: 'DESC' },
    },
    pagination: { maxLimit: 50 },
    schemaMapping: { realm: 'realm' },
    throwOnFailure: true,   // contract violations become 400s instead of silent drops
}));
```

`throwOnFailure` is a taste decision: without it, disallowed input is dropped and the request still succeeds (forgiving mode); with it, clients get told. See [drop vs. throw](/guide/schemas#failure-behavior-drop-vs-throw).

## 2. The decoder

```typescript
// src/decoder.ts
import { URLDecoder } from '@rapiq/codec-url-simple';
import { registry } from './schema';

export const decoder = new URLDecoder(registry);
```

The decoder is stateless — share one instance across all routes.

## 3. The endpoint

```typescript
// src/routes/users.ts
import type { Request, Response } from 'express';
import { ParseError } from '@rapiq/core';
import { TypeormAdapter } from '@rapiq/typeorm';
import { dataSource } from '../data-source';
import { decoder } from '../decoder';
import { User } from '../entities';

const adapterConfig = { relations: { joinAndSelect: true } };

export async function getUsers(req: Request, res: Response) {
    let query;
    try {
        query = decoder.decode(req.query, { schema: 'user' });
    } catch (e) {
        if (e instanceof ParseError) {
            return res.status(400).json({ error: e.message, code: e.code });
        }
        throw e;
    }
    if (!query) {
        return res.status(400).json({ error: 'Invalid query input.' });
    }

    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    // adapter & builder are per-request; the config object is shared
    const adapter = new TypeormAdapter({ ...adapterConfig, queryBuilder });
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

## What clients can now do

```
GET /users                                            defaults: id+name, sorted -id, limit 50
GET /users?filter[age]=>=18&sort=-age                 filtered & sorted
GET /users?include=realm&fields[realm]=name           relation + sparse fields
GET /users?page[limit]=10&page[offset]=20             paged, capped at 50
GET /users?filter[secret]=x                           400 — key not allowed
```

## Variations

- **Scope by the authenticated user** — inject filters the client can't displace: [Authorization & scoping](/guide/recipes/authorization).
- **No TypeORM** — swap the adapter for [`@rapiq/sql`](/packages/sql) fragments; the decode half stays identical.
- **Accept `or(...)` filters** — add the [expression codec](/packages/codec-url-expression), or dispatch both dialects with [`@rapiq/codec-url`](/packages/codec-url).

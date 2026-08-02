# Swapping the Backend: Prisma & Drizzle

*Chapter 4 of the recipes storyline: the execute layer. The contract and codec from [REST API with Express & TypeORM](/guide/recipes/express-typeorm) stay untouched; only the adapter changes. Next: [MongoDB-Style Search Endpoint](/guide/recipes/mongo-search).*

Chapter 3 ended with a TypeORM endpoint. This chapter re-bases the same `/users` route on [`@rapiq/adapter-prisma`](/packages/adapter-prisma) and then on [`@rapiq/adapter-drizzle`](/packages/adapter-drizzle) to make a point: the schema, the codec, the route shape and the response envelope are backend-independent. Swapping the database layer is a one-file diff.

## What stays

```txt
src/
├── schema.ts        # unchanged: the contract from chapter 3
├── codec.ts         # unchanged: the shared codec from chapter 3
└── routes/users.ts  # the only file this chapter touches
```

Both adapters are **pure serializers**: `execute(query)` returns a plain value (a `findMany` argument object for Prisma, a relational query config for Drizzle) instead of mutating a builder. That flips two habits from the TypeORM route:

- the adapter is **stateless**: construct one instance per model/table and share it across requests, instead of one per request;
- a serializer does not inspect your database or entities, so the model facts arrive as options: `metadata` and `provider` are **required**.

## The endpoint on Prisma

```typescript
// src/routes/users.ts
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ParseError } from '@rapiq/core';
import { PrismaAdapter, defineMetadata } from '@rapiq/adapter-prisma';
import { codec } from '../codec';
import { prisma } from '../prisma';

// stateless: one instance per model, shared across requests.
// On Prisma 7 the runtime datamodel is pruned, so hand-write the
// same shape there; see the metadata note below.
const adapter = new PrismaAdapter<Prisma.UserFindManyArgs>({
    provider: 'postgresql',
    metadata: defineMetadata(Prisma.dmmf.datamodel, 'User'),
});

export async function getUsers(req: Request, res: Response) {
    let query;
    try {
        query = codec.decode(req.query, { schema: 'user' });
    } catch (e) {
        if (e instanceof ParseError) {
            return res.status(400).json({ error: e.message, code: e.code });
        }
        throw e;
    }
    if (!query) {
        return res.status(400).json({ error: 'Invalid query input.' });
    }

    const { args, pagination } = adapter.execute(query);

    const [data, total] = await Promise.all([
        prisma.user.findMany(args),
        // filters, but never the page window: the pre-pagination total
        prisma.user.count({ where: args.where }),
    ]);

    return res.json({
        data,
        meta: {
            total,
            limit: pagination.limit,
            offset: pagination.offset,
        },
    });
}
```

The decode half, the 400s and the `meta` envelope are copied from chapter 3 unchanged. Note what is *absent*: the `joinAndSelect` knob from the TypeORM route is builder-specific; a serializer hydrates every included relation by construction (`include` on Prisma, `with` on Drizzle).

`metadata` answers four questions (is a path a relation, is it to-many, can the column hold null, does it hold strings), and each one changes what a *valid* Prisma filter looks like, so the adapter refuses to run without it. `provider` decides whether `mode: 'insensitive'` may be emitted for the case-insensitive default. Both are required **by design**: a wrong guess would be a runtime validation error, not graceful degradation. Details: [model metadata](/packages/adapter-prisma#model-metadata) and [case sensitivity](/packages/adapter-prisma#case-sensitivity).

::: tip Model-bound runners
Constructed with a model delegate instead (`new PrismaAdapter({ model: prisma.user, metadata })`), the adapter can also run what it serialized: `adapter.findMany(query)` and `adapter.count(query)`. See [running the query](/packages/adapter-prisma#running-the-query).
:::

## The endpoint on Drizzle

Drizzle's metadata is a hand-written datamodel in drizzle's own vocabulary (`dataType` as on a drizzle column, relations keyed the way `defineRelations` keys them); a bare string is shorthand for `{ dataType }`:

```typescript
// src/routes/users.ts
import type { Request, Response } from 'express';
import { ParseError } from '@rapiq/core';
import { DrizzleAdapter, defineMetadata } from '@rapiq/adapter-drizzle';
import { codec } from '../codec';
import { db } from '../db';

// stateless: one instance per table, shared across requests
const adapter = new DrizzleAdapter({
    provider: 'pg',
    metadata: defineMetadata({
        users: {
            columns: {
                id: { dataType: 'number', nullable: false },
                name: 'string',
                email: 'string',
                age: { dataType: 'number', nullable: false },
            },
            relations: {
                realm: { target: 'realms', many: false },
            },
        },
        realms: {
            columns: {
                id: { dataType: 'string', nullable: false },
                name: 'string',
            },
        },
    }, 'users'),
});

export async function getUsers(req: Request, res: Response) {
    let query;
    try {
        query = codec.decode(req.query, { schema: 'user' });
    } catch (e) {
        if (e instanceof ParseError) {
            return res.status(400).json({ error: e.message, code: e.code });
        }
        throw e;
    }
    if (!query) {
        return res.status(400).json({ error: 'Invalid query input.' });
    }

    const { config, pagination } = adapter.execute(query);

    const data = await db.query.users.findMany(config);

    // the relational API ships no count runner: reuse the produced
    // where for an id-only query. An unsatisfiable filter surfaces
    // as `limit: 0`, never in the where; the pagination echo tells
    // it apart from a client-sent page[limit]=0, which still counts.
    const impossible = config.limit === 0 && pagination.limit !== 0;
    const total = impossible
        ? 0
        : (await db.query.users.findMany({
            where: config.where,
            columns: { id: true },
        })).length;

    return res.json({
        data,
        meta: {
            total,
            limit: pagination.limit,
            offset: pagination.offset,
        },
    });
}
```

Same story: only the execute layer moved. `provider` and `metadata` are required here for the same reason as on Prisma; the drizzle facts decide the shape of a *correct* filter object (relation presence tests, complement null arms, `ilike` folding). Details: [table metadata](/packages/adapter-drizzle#table-metadata) and [case sensitivity](/packages/adapter-drizzle#case-sensitivity).

## The contract did not move

Every wire request from chapter 3 works unchanged, on either backend:

```txt
GET /users?filter[age]=>=18&sort=-age                 filtered & sorted
GET /users?include=realm&fields[realm]=name           include -> Prisma include / Drizzle with
GET /users?filter[secret]=x                           still 400: key not allowed
```

And the semantics move with the query, not with the backend: null-inclusive complements for negated operators, the case-insensitive default, same-element binding on to-many paths. The adapters render them differently (Prisma gets explicit `OR` null arms, Drizzle gets `isNull` arms and `ilike`), but the result sets are pinned identical by engine-backed parity suites.

## Scoping stays one option away

Both adapters take a `base` option: an application-owned baseline that the client's conditions are conjoined with, never substituted for:

```typescript
const { args } = adapter.execute(query, {
    base: { where: { realm_id: req.actor.realmId } },
});

// where: { AND: [ { realm_id: ... }, { ...client filters } ] }
```

The Drizzle form is identical with `config` in place of `args`. [Authorization & Scoping](/guide/recipes/authorization) treats scoping in depth.

## What changed

| | TypeORM (chapter 3) | Prisma / Drizzle |
|---|---|---|
| Adapter lifetime | per request, bound to a builder | one stateless instance, shared |
| Output | mutates the query builder | a plain args / config value |
| Model facts | read from entity metadata | `metadata` + `provider`, required options |
| Total for `meta` | `getManyAndCount()` | `prisma.user.count()` / an id-only second query |

What did **not** change: `schema.ts`, `codec.ts`, the wire format, the decode-then-400 route shape, and the `meta` envelope.

## Honest limitations

Operators these backends cannot express natively raise a typed `AdapterError` (`FEATURE_UNSUPPORTED`) instead of being approximated: `regex`, `mod`, `size` and the `$this` element marker, on both adapters. Drizzle additionally rejects ordering by a relation path; Prisma rejects `elemMatch` on a to-one relation. Loud beats a silent semantic downgrade; the full lists live at [Prisma limitations](/packages/adapter-prisma#limitations) and [Drizzle limitations](/packages/adapter-drizzle#limitations).

## Next steps

- [MongoDB-Style Search Endpoint](/guide/recipes/mongo-search): chapter 5 swaps the input dialect instead.
- [@rapiq/adapter-prisma](/packages/adapter-prisma) / [@rapiq/adapter-drizzle](/packages/adapter-drizzle): the full adapter references.
- [Executing Queries](/guide/executing-queries): the adapter surface shared by all backends.

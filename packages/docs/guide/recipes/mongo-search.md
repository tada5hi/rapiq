# MongoDB-Style Search Endpoint

*Chapter 5 of the [recipes storyline](/guide/recipes/): after [the previous chapter](/guide/recipes/prisma-drizzle) swapped the execute layer, this one swaps the input dialect; the contract from [chapter 3](/guide/recipes/express-typeorm) stays. Next: [Testing with the Memory Adapter](/guide/recipes/testing-memory).*

URL query strings suit `GET` list endpoints, but filters do not always travel that way: complex search forms, saved filters, or a caller that already speaks the [MongoDB query language](https://www.mongodb.com/docs/manual/reference/operator/query/) all want structured JSON. [`@rapiq/parser-mongo`](/packages/parser-mongo) parses a MongoDB-style filter document into the same [`Query`](/guide/query-ast) as every other dialect, validated against the same schema. The server does **not** run MongoDB; the dialect is input syntax only.

This chapter adds `POST /users/search` next to chapter 3's `GET /users`. The contract module (`src/schema.ts`) and the execution half are untouched; only the parse step changes.

## The endpoint

```typescript
// src/routes/users-search.ts
import type { Request, Response } from 'express';
import { isParseError } from '@rapiq/core';
import { MongoParser } from '@rapiq/parser-mongo';
import { TypeormAdapter } from '@rapiq/adapter-typeorm';
import { dataSource } from '../data-source';
import { registry } from '../schema';
import { User } from '../entities';

const parser = new MongoParser(registry);

export async function searchUsers(req: Request, res: Response) {
    let query;
    try {
        query = parser.parse(req.body, { schema: 'user' });
    } catch (e) {
        if (isParseError(e)) {
            return res.status(400).json({ error: e.message, code: e.code });
        }
        throw e;
    }

    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    const adapter = new TypeormAdapter({
        relations: { joinAndSelect: true },
        queryBuilder,
    });
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

Wire it up with a JSON body parser: `app.use(express.json())` and `app.post('/users/search', searchUsers)`. Like the codec, the parser is stateless between calls; share one instance across routes. Unlike `codec.decode`, `parser.parse` never returns `null`: it returns a `Query`, and everything invalid throws.

## What clients send

```json
{
    "filters": {
        "$or": [
            { "name": { "$contains": "ada" } },
            { "age": { "$gte": 18, "$lt": 65 } }
        ],
        "realm.id": "a"
    },
    "relations": ["realm"],
    "sorts": "-age",
    "pagination": { "limit": 25 }
}
```

Multiple document entries combine with an implicit AND, a bare scalar means `$eq`, a bare array means `$in`, and dotted keys reach relation paths; the full operator table lives on the [package page](/packages/parser-mongo#the-dialect).

Only `filters` is mongo-flavored. `fields`, `relations`, `sorts` and `pagination` accept the same shapes as the [simple dialect](/packages/parser-simple) from chapter 3, and every schema constraint applies unchanged: the filter allow-list, the relations allow-list, the `maxLimit` of 50, the `-id` sort default when the client sends none.

## Typed values, no wire grammar

The URL dialects are untyped; every value crosses the wire as a string and the wire grammar coerces it back. A JSON body carries real types, so nothing is coerced:

```txt
filter[age]=>=18                 URL simple: a string, operator and value share one token
filter=gte(age,'18')             URL expression: value quoted as a string, coerced on decode
{ "age": { "$gte": 18 } }        JSON body: a real number reaches the AST untouched
```

That buys three things the URL dialects cannot express:

- **Numbers and booleans stay themselves.** `18` is a number, `true` is a boolean; there is no string-form ambiguity.
- **`null` is a real null.** `{ "field": null }` is an is-null test (see [null semantics](/guide/filters#null-semantics)), never the string `'null'`.
- **Operators without a URL grammar become reachable.** `$regex` (as a pattern string, optionally with `$options`), `$mod`, `$size`, `$elemMatch` and `$all` have no expression spelling but parse fine from a document. When calling `parse()` in-process, `Date` and `RegExp` instances pass through as-is; over JSON, an ISO date string stays a string and is **not** coerced to a `Date`.

::: warning Untrusted `$regex`
This is the only dialect that lets a client submit a regular expression. Here the pattern is handed to the database engine; if the same queries are ever evaluated in-process with [`@rapiq/adapter-memory`](/packages/adapter-memory) (next chapter), a crafted pattern can burn CPU. Gate the operator with the schema's `filters.validate` hook: see the [regex trust model](/guide/filters#regex-trust-model).
:::

## Grammar errors vs. contract violations

The parser splits failures into two classes:

- **Grammar errors always throw** `FiltersParseError`, no matter what the schema's failure policy says: unknown or misplaced `$`-operators, malformed operator values, invalid compound arrays. A `$`-prefixed key is never a field name, so a broken document has no silent-drop reading.
- **Allow-list failures follow the schema policy.** This contract sets `throwOnFailure: true`, so an undeclared field key throws too; without it, the offending entry (an `$elemMatch` subtree included) would be dropped silently and the schema defaults would fill the gaps.

```txt
{ "filters": { "age": { "$type": "number" } } }    400, code operatorUnsupported (grammar, throws regardless)
{ "filters": { "secret": "x" } }                   400, code keyNotAllowed (contract, throws via throwOnFailure)
```

`FiltersParseError` extends `ParseError`, so the handler's single `catch` branch maps both classes to a `400`. See the [failure model](/packages/parser-mongo#failure-model) for the full error-code table.

## Variations

- **Per-actor gating**: schemas with async `validate` hooks need `parser.parseAsync(req.body, { schema: 'user', context: req.actor })`; the hooks and context are the subject of [Authorization & Scoping](/guide/recipes/authorization).
- **Different backend**: swap the execute half exactly as chapter 4 did for [Prisma & Drizzle](/guide/recipes/prisma-drizzle); the parse half stays identical.
- **Filters only**: the standalone `MongoFiltersParser` returns just the `Filters` node, useful when a stored filter document must be revalidated without the other parameters.

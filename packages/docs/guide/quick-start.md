# Quick Start

This walkthrough takes one query all the way: **built on the client → sent as a URL → validated on the server → executed against a database**. At the end you have a fully working, safely constrained list endpoint.

Both sides share the same record types:

```typescript
type Realm = {
    id: string,
    name: string,
};

type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: Realm,
};
```

## 1. Build a query (caller)

`defineQuery` builds a typed query — the record generic checks every field path against `User`:

```typescript
import { defineQuery } from '@rapiq/core';
import { createURLCodec } from '@rapiq/codec-url';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { age: { $gte: 18 } },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25, offset: 0 },
});

const queryString = createURLCodec().encode(query);
// codec=url-expression&fields=id,name&filter=gte(age%2C'18')&page[limit]=25&...

const response = await fetch(`/users?${queryString}`);
```

Filters accept scalars (`{ name: 'John' }`), arrays (`{ id: [1, null] }` — an *in* list), `$`-operator objects and condition helpers like `or(gte('age', 18), eq('email', null))`. The full grammar lives in [Building Queries](/guide/building-queries).

## 2. Declare what clients may request (server)

A `Schema` is the server's contract: an allow-list per parameter. Register one per resource:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const registry = new SchemaRegistry();

registry.add(defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name'] },
}));

registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'name', 'age'] },
    pagination: { maxLimit: 50 },
    schemaMapping: { realm: 'realm' },
}));
```

`schemaMapping` connects the `realm` relation to the `realm` schema, so nested input like `fields[realm]=name` validates against the *realm* allow-lists.

## 3. Decode & validate (server)

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec(registry);

app.get('/users', async (req, res) => {
    // accepts a raw query string or a pre-parsed object (express req.query)
    const query = codec.decode(req.query, { schema: 'user' });
    if (!query) {
        // null for non-object input → 400 Bad Request
        return res.status(400).end();
    }
    // ...
});
```

Fields, relations, sort and pagination follow the schema's drop-vs-throw policy. Expression-filter violations are precise and reject the request; legacy simple filters drop invalid leaves unless `throwOnFailure` is enabled. See [Schemas & Validation](/guide/schemas).

## 4. Execute (server)

With TypeORM, the adapter applies the query to a `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins:

```typescript
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    queryBuilder,
    relations: { joinAndSelect: true },
});

const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();

res.json({
    data: entities,
    meta: { total, limit: pagination.limit, offset: pagination.offset },
});
```

No TypeORM? [`@rapiq/sql`](/packages/sql) renders parameterized SQL fragments for any driver, and [`@rapiq/memory`](/packages/memory) evaluates the same query against plain arrays.

## What just happened

1. The caller expressed *intent* in a typed structure — no hand-built query strings.
2. The wire carried a self-described expression filter alongside JSON:API-style parameters.
3. The server enforced its contract *before* anything touched the database.
4. The adapter translated the validated query mechanically — values are always bound as parameters, never interpolated.

## Next steps

- [Core Concepts](/guide/concepts) — the four moving parts behind these steps.
- [Building Queries](/guide/building-queries) — the full client-side grammar.
- [Schemas & Validation](/guide/schemas) — defaults, aliases, strict mode, failure policy.
- [Recipes: REST API with Express & TypeORM](/guide/recipes/express-typeorm) — the complete endpoint with error handling.

# Quick Start

This walkthrough takes a query from the client, over the wire, through validation, into a database query.

Shared types for both sides:

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

## 1. Build a query (client)

Build a `Query` from typed input with [`defineQuery`](/guide/build) and encode it as a URL query string:

```typescript
import { defineQuery } from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { age: { $gte: 18 } },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25, offset: 0 },
});

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&page[offset]=0&include=realm&sort=-age

const response = await fetch(`/users?${queryString}`);
```

The record generic types every field path against `User`. Filters take scalars (`{ name: 'John' }`), arrays (`{ realm_id: [1, null] }`), `$`-operator objects and [condition helpers](/guide/build#condition-helpers) like `or(gte('age', 18), eq('email', null))` — see [Building Queries](/guide/build) for the full grammar.

## 2. Parse & validate (server)

Declare a `Schema` — the allow-list of what a client may request — and parse the incoming input against it:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';

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

const parser = new SimpleParser(registry);

// express parses the query string into an object for you (req.query)
const query = parser.parse(req.query, { schema: 'user' });
```

Anything outside the allow-lists is silently dropped; set `throwOnFailure: true` on the schema to get a `ParseError` instead. See [Schemas](/guide/schema).

::: tip Raw query strings
If you only have the raw string, parse it with [qs](https://www.npmjs.com/package/qs) and feed the result to `SimpleParser` — or use the schema-less [`URLDecoder`](/integrations/url) when validation isn't needed.
:::

## 3. Apply to the database (server)

With TypeORM, the adapter mutates a `SelectQueryBuilder` in place:

```typescript
import { QueryVisitor } from '@rapiq/sql';
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    relations: { joinAndSelect: true },
});
adapter.withQuery(queryBuilder);

query.accept(new QueryVisitor(adapter));
adapter.execute();

const [entities, total] = await queryBuilder.getManyAndCount();
```

Without TypeORM, [`@rapiq/sql`](/integrations/sql) renders parameterized SQL fragments you can feed to any driver.

## Going further

- [Concepts](/guide/) — the Query AST, schemas and the visitor pattern.
- [Building Queries](/guide/build) — the typed build layer: `defineQuery`, condition helpers, fragments.
- [Merging Queries](/guide/merge) — composing queries with `mergeQueries` and the filter combinators.
- [Filters](/guide/filters) — every filter operator and its syntax.
- [Integrations](/integrations/) — parsers, codecs and backend adapters in detail.

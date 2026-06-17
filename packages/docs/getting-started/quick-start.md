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

Construct a `Query` from AST nodes and encode it as a URL query string:

```typescript
import {
    Field, Fields,
    Filter, FilterCompoundOperator, FilterFieldOperator, Filters,
    Pagination, Query, Relation, Relations, Sort, Sorts,
} from '@rapiq/core';
import { URLEncoder } from '@rapiq/codec-url-simple';

const query = new Query({
    fields: new Fields([new Field('id'), new Field('name')]),
    filters: new Filters(FilterCompoundOperator.AND, [
        new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18),
    ]),
    relations: new Relations([new Relation('realm')]),
    sorts: new Sorts([new Sort('age', 'DESC')]),
    pagination: new Pagination(25, 0),
});

const encoder = new URLEncoder();
const queryString = encoder.encode(query);
// fields=id,name&filter[age]=>=18&page[limit]=25&page[offset]=0&include=realm&sort=-age

const response = await fetch(`/users?${queryString}`);
```

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
- [Filters](/guide/filters) — every filter operator and its syntax.
- [Integrations](/integrations/) — parsers, codecs and backend adapters in detail.

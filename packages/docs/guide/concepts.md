# Core Concepts

rapiq has four moving parts — **Query**, **Schema**, **Parser**, **Adapter**. Everything else in the package family is a variation of one of them. Understanding these four once makes every other page in these docs a detail.

Everything meets in the middle:

<QueryHub />

## Query — the shared language

A `Query` is a small, typed object tree (an AST) with one collection per parameter:

```typescript
class Query {
    readonly fields: IFields;         // which fields to return
    readonly filters: IFilters;       // and/or tree of conditions
    readonly relations: IRelations;   // which related resources to load
    readonly sorts: ISorts;           // order keys + direction
    readonly pagination: IPagination; // { limit, offset }
}
```

It is the **only** thing the packages share — parsers produce it, codecs transport it, schemas constrain it, adapters consume it. That single meeting point is what makes the pieces swappable: the TypeORM adapter neither knows nor cares whether a query arrived as a URL, an expression string, a MongoDB-style document or was built in code.

There are three ways to obtain one:

| You have… | Use | Where |
|---|---|---|
| Typed input in code | [`defineQuery`](/guide/building-queries) + condition helpers | caller side |
| Raw wire input | a [parser or URL decoder](/guide/wire) | receiver side |
| Special needs | [hand-assembled AST nodes](/guide/query-ast) | rarely |

### One query, four notations

All of these produce the *same* `Query`:

::: code-group

```typescript [defineQuery]
defineQuery<User>({
    filters: { age: { $gte: 18 }, name: { $contains: 'jo' } },
});
```

```txt [URL (legacy simple)]
filter[age]=>=18&filter[name]=~jo~
```

```txt [URL (expression default)]
codec=url-expression&filter=and(gte(age, '18'), contains(name, 'jo'))
```

```typescript [MongoDB-style]
{ filters: { age: { $gte: 18 }, name: { $contains: 'jo' } } }
```

:::

Dialects are input syntax only; semantics live in the AST.

## Schema — the server's contract

A `Schema<RECORD>` declares what a client *may* request, per parameter — allowed keys, defaults, alias mappings, a pagination cap:

```typescript
const userSchema = defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email'], default: ['id', 'name'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'], default: { id: 'DESC' } },
    pagination: { maxLimit: 50 },
    schemaMapping: { realm: 'realm' },
});
```

Parsers consult the schema *while* parsing: disallowed input is dropped by default, or throws when `throwOnFailure` is set. A `SchemaRegistry` stores schemas by name so relation paths (`realm.name`) validate against the *related* record's schema. Details in [Schemas & Validation](/guide/schemas).

## Parser — from input to Query

Parsers turn raw, untrusted input into a validated `Query`. Each speaks one input *dialect*:

- [`SimpleParser`](/packages/parser-simple) — plain objects/arrays, URL-query-like (`{ age: '>=18' }`)
- [`ExpressionParser`](/packages/parser-expression) — expression strings (`and(eq(name, 'John'), gte(age, '18'))`)
- [`MongoParser`](/packages/parser-mongo) — MongoDB-style documents (`{ age: { $gte: 18 } }`)

Parsers are transport-agnostic: they read canonical parameter keys (`fields`, `filters`, …) and don't know about URLs. The [`URLCodec`](/guide/wire) façade maps URL wire names (`filter`, `page`, `include`, …) onto the matching parser and performs the reverse trip. It hides expression/simple dialect dispatch from callers.

## Adapter — from Query to results

Adapters execute a `Query` against a backend:

- [`@rapiq/typeorm`](/packages/typeorm) — mutates a TypeORM `SelectQueryBuilder`
- [`@rapiq/sql`](/packages/sql) — renders parameterized SQL fragments for any driver
- [`@rapiq/memory`](/packages/memory) — compiles the query into plain functions over in-memory data

They all consume the AST through the **visitor pattern**: every node has `accept(visitor)`, and a backend implements visitor interfaces for the nodes it cares about. New backends never require changes to core — see [The Query AST](/guide/query-ast) if you want to build one.

## Composition — queries are values

Because queries are plain immutable-ish values, they compose *after* construction, regardless of where each part came from:

```typescript
import { mergeQueries } from '@rapiq/core';

const query = mergeQueries(userInput, componentDefaults, appDefaults);
```

And the server can inject conditions a client can never displace:

```typescript
const scoped = new Query({
    ...query,
    filters: query.filters.and(eq('realm_id', actor.realmId)),
});
```

Both patterns are covered in [Merging & Composition](/guide/merging-queries).

## Where each package sits

| Stage | Packages |
|---|---|
| Build | `@rapiq/core` (`defineQuery`, helpers) |
| Transport | `@rapiq/codec-url` |
| Parse & validate | `@rapiq/parser-simple`, `@rapiq/parser-expression`, `@rapiq/parser-mongo` + `Schema` from core |
| Execute | `@rapiq/typeorm`, `@rapiq/sql`, `@rapiq/memory` |

## Next steps

Follow the pipeline in order:

1. [Building Queries](/guide/building-queries)
2. [Schemas & Validation](/guide/schemas)
3. [Queries over the Wire](/guide/wire)
4. [Executing Queries](/guide/executing-queries)

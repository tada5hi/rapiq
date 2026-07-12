# @rapiq/core

The foundation of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

This package owns the query AST (`Query` with fields, filters, pagination, relations & sorts), the typed build layer, the schema system and the visitor interfaces every other `@rapiq/*` package builds on.

## Installation

```sh
npm install @rapiq/core
```

## Usage

### Build a query

`defineQuery` builds the AST directly from typed input — every field path is checked against the record generic:

```typescript
import { defineQuery, gte, or, eq } from '@rapiq/core';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: or(gte('age', 18), eq('deleted_at', null)),
    relations: ['realm'],
    sort: '-created_at',
    pagination: { limit: 10 },
});
```

Filters accept scalars (`{ name: 'John' }`), bare arrays (`in`, `null` is a legal element), `$`-operator objects (`{ age: { $gte: 18 } }`) and condition helpers (`eq`, `gte`, `inArray`, `and`, `or`, …). Queries compose immutably with `mergeQueries` (left priority) and the `Filters` combinators (`merge`, `and`, `or`).

### Declare what a caller may request

A `Schema` is the receiving side's allow-list — parsers and decoders validate incoming input against it:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const registry = new SchemaRegistry();

registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'] },
    pagination: { maxLimit: 50 },
    schemaMapping: { realm: 'realm' },
}));
```

### Consume the AST

Every node implements `accept(visitor)` — backends implement the visitor interfaces (`IQueryVisitor`, `IFiltersVisitor`, …) to walk a query into whatever they target. Ready-made adapters exist for [SQL](https://www.npmjs.com/package/@rapiq/sql) and [TypeORM](https://www.npmjs.com/package/@rapiq/typeorm); parsers and URL codecs live in their own packages as well.

## Documentation

Full guide: [rapiq.tada5hi.net](https://rapiq.tada5hi.net) — see [Building Queries](https://rapiq.tada5hi.net/guide/building-queries), [Schemas](https://rapiq.tada5hi.net/guide/schemas) and [Merging Queries](https://rapiq.tada5hi.net/guide/merging-queries).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

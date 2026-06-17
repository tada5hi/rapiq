# TypeORM

`@rapiq/typeorm` applies a parsed [`Query`](/guide/query) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

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

The flow is always the same:

1. `withQuery(queryBuilder)` — attach the builder.
2. `query.accept(new QueryVisitor(adapter))` — walk the AST; the adapter collects state.
3. `adapter.execute()` — apply everything to the builder in one go.

## Options

```typescript
new TypeormAdapter({
    relations: {
        joinAndSelect: true,
    },
});
```

| Option | Description |
|---|---|
| `relations.joinAndSelect` | Use `innerJoinAndSelect` (hydrate the related entities) instead of `innerJoin` (join for filtering/sorting only). |

Relations are validated against the entity metadata of the attached query builder — a requested relation that doesn't exist on the entity is ignored.

## Applying a single parameter

Per-parameter visitors from `@rapiq/sql` work against the adapter's sub-adapters when only part of a query applies:

```typescript
import { FiltersVisitor } from '@rapiq/sql';

const adapter = new TypeormAdapter();
adapter.withQuery(queryBuilder);

query.filters.accept(new FiltersVisitor(adapter.filters));
adapter.execute();
```

The same pattern works with `FieldsVisitor` (`adapter.fields`), `SortsVisitor` (`adapter.sort`), `PaginationVisitor` (`adapter.pagination`) and `RelationsVisitor` (`adapter.relations`).

## End-to-end example

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import { QueryVisitor } from '@rapiq/sql';
import { TypeormAdapter } from '@rapiq/typeorm';

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

const parser = new SimpleParser(registry);

export async function getUsers(req: Request, res: Response) {
    const query = parser.parse(req.query, { schema: 'user' });

    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    const adapter = new TypeormAdapter({ relations: { joinAndSelect: true } });
    adapter.withQuery(queryBuilder);
    query.accept(new QueryVisitor(adapter));
    adapter.execute();

    const [entities, total] = await queryBuilder.getManyAndCount();

    return res.json({
        data: entities,
        meta: {
            total,
            limit: query.pagination.limit,
            offset: query.pagination.offset,
        },
    });
}
```

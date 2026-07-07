# @rapiq/typeorm

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Applies a parsed [`Query`](https://rapiq.tada5hi.net/guide/query) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

## Installation

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
const { pagination } = adapter.execute();

const [entities, total] = await queryBuilder.getManyAndCount();
```

The flow is always the same:

1. `withQuery(queryBuilder)` — attach the builder.
2. `query.accept(new QueryVisitor(adapter))` — walk the AST; the adapter collects state.
3. `adapter.execute()` — apply everything to the builder in one go; it returns the applied pagination (e.g. for the response `meta` block).

The SQL dialect is resolved from the attached builder's connection type; joins are applied idempotently and validated against the entity metadata. Options: `relations.joinAndSelect` (hydrate related entities), `relations.joinType` (`'left'` default / `'inner'`), and an `onJoin(path, alias, queryBuilder)` hook per applied join. Per-parameter visitors from [@rapiq/sql](https://www.npmjs.com/package/@rapiq/sql) work against the adapter's sub-adapters (`adapter.filters`, `adapter.sort`, …) when only part of a query applies.

Typically the query comes from a [URL decoder](https://www.npmjs.com/package/@rapiq/codec-url-simple) validating `req.query` against a schema — see the [end-to-end example](https://rapiq.tada5hi.net/integrations/typeorm#end-to-end-example) in the docs.

Migrating from typeorm-extension's `applyQuery`? The defaults mirror its contract (`leftJoinAndSelect`, returned pagination) — see the [migration guide](https://rapiq.tada5hi.net/guide/migration).

## Documentation

Full guide (options, dialect detection, alias convention): [rapiq.tada5hi.net/integrations/typeorm](https://rapiq.tada5hi.net/integrations/typeorm)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

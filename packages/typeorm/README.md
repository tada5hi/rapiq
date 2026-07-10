# @rapiq/typeorm

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Applies a parsed [`Query`](https://rapiq.tada5hi.net/guide/query) directly to a TypeORM `SelectQueryBuilder` — filters become parameterized `WHERE` conditions, relations become joins, fields/sort/pagination map to `select`/`orderBy`/`take`+`skip`.

## Installation

```sh
npm install @rapiq/core @rapiq/sql @rapiq/typeorm
```

## Usage

```typescript
import { TypeormAdapter } from '@rapiq/typeorm';

const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

const adapter = new TypeormAdapter({
    queryBuilder,
    relations: { joinAndSelect: true },
});

const { pagination } = adapter.execute(query);

const [entities, total] = await queryBuilder.getManyAndCount();
```

The `queryBuilder` (the builder to write into) is bound at construction; `adapter.execute(query)` then walks the parsed `Query`, collects the state into its sub-adapters, and applies it to that builder — returning the applied pagination (e.g. for the response `meta` block). State is cleared before each call by default (pass `{ clear: false }` as the second argument to apply several queries onto the same builder).

Construct the adapter **per request**, like the `SelectQueryBuilder` you hand it — it holds per-call state. The shareable, long-lived part is your config (`relations`, …), spread into the per-request options with the request's builder as `queryBuilder`.

The SQL dialect is resolved from the attached builder's connection type; joins are applied idempotently and validated against the entity metadata. Options: `relations.joinAndSelect` (hydrate related entities), `relations.joinType` (`'left'` default / `'inner'`), and an `onJoin(path, alias, queryBuilder)` hook per applied join. Per-parameter visitors from [@rapiq/sql](https://www.npmjs.com/package/@rapiq/sql) work against the adapter's sub-adapters (`adapter.filters`, `adapter.sort`, …) when only part of a query applies.

Typically the query comes from a [URL decoder](https://www.npmjs.com/package/@rapiq/codec-url-simple) validating `req.query` against a schema — see the [end-to-end example](https://rapiq.tada5hi.net/integrations/typeorm#end-to-end-example) in the docs.

Migrating from typeorm-extension's `applyQuery`? The defaults mirror its contract (`leftJoinAndSelect`, returned pagination) — see the [migration guide](https://rapiq.tada5hi.net/guide/migration).

## Documentation

Full guide (options, dialect detection, alias convention): [rapiq.tada5hi.net/integrations/typeorm](https://rapiq.tada5hi.net/integrations/typeorm)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

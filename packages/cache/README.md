<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/cache</h1>

<p align="center">
  <b>A tag-invalidated result cache for rapiq queries.</b><br>
  A result depends on every row it contains and on the sets it selected from; the cache<br>
  derives those dependencies from the <code>Query</code> and the schema, and a write bumps them.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/cache"><img src="https://img.shields.io/npm/v/@rapiq/cache?color=%23a21caf&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/cache"><img src="https://img.shields.io/npm/types/@rapiq/cache?color=%23db2777" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/cache?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/cache"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/cache">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq). Typed REST queries: *build, transport, validate, execute.*
A cached query result cannot be keyed on one value: it depends on every row it holds and on the membership of the sets it selected from. So a stored value carries **tags**, every tag has a **version** on one logical clock, and a write bumps the tags it owns. A read compares versions and answers a miss the moment any dependency moved.

- 🏷️ **Tags derived from the query**: `collectQueryTags` walks the filters, relations, sorts and fields of a `Query` plus the hydrated rows and names every collection, scope and record the result depends on. The writing side derives the same names from the same schema.
- 🕰️ **Versions, not sets**: a tag is a number, not an index of keys. No `tag -> keys` index that grows without bound, no sweeper, no normalization layer re-implementing relation hydration.
- 🔒 **Race-safe by construction**: the clock is read before the database read and re-checked at store time. A writer committing during the read refuses the entry, one committing after it moves the tags past it, and a tag with an unknown history (evicted, or lapsed after a bump) fails closed.
- 🧩 **Drivers behind one contract**: a zero-dependency `MemoryCacheDriver` ships here; `@rapiq/cache-redis` implements the same `ICacheDriver` over Redis. One shared contract suite pins the semantics for both.

## Installation

```sh
npm install @rapiq/core @rapiq/cache
```

## Usage

```typescript
import { defineQuery, SchemaRegistry } from '@rapiq/core';
import { MemoryCacheDriver, TaggedCache, rememberQuery } from '@rapiq/cache';

const cache = new TaggedCache({
    driver: new MemoryCacheDriver({ maxTtl: 60_000 }),
    onError: (e) => logger.warn('cache unavailable', e),
});

const query = defineQuery<Role>({ relations: ['realm'] });

const role = await rememberQuery(cache, {
    // everything that selects the result: the path id AND the executed query (fields included)
    key: `role/${id}?${codec.encode(query)}`,
    query,
    schema: 'role',
    registry,
    // exactly what the query is executed with; without it no string filter value scopes
    caseSensitive: ['id', 'realmId'],
}, () => repository.findOne({ where: { id }, relations: { realm: true } }));
// stored under: role, realm, role:<id>, realm:<id>

// the write side, after the transaction committed:
await cache.invalidate(['realm', 'realm:x']);
```

The key is yours and must encode every input that selects the result: the query as executed (after the server appended its own conditions), the `fields` parameter, and every input outside the query, such as the `:id` of `GET /roles/:id` or a route realm. A key made of the encoded query alone is shared by every id and serves the first id's row to all of them.

`rows` unwraps a value that is not a row or a list of rows, so its record tags are found: `rows: ([rows]) => rows` for a `findAndCount` tuple, `rows: (value) => value.data` for an envelope. `primaryKey` names the key property (default `id`).

## How a read stays correct

Every driver implements a clock read and three atomic steps:

```text
write(key, entry, ttl)      refuse when the clock moved below the entry, or any tag was bumped past it;
                            an absent tag is re-created at the current clock, never at 0
read(key)                   miss when absent, expired, the clock is behind, a tag is missing or bumped past
invalidate(tags)            clock + 1; every tag <- clock
```

`TaggedCache.remember` reads the clock BEFORE it runs your read, and hands that clock to the store together with the value and its tags. A bump landing during the read makes the store refuse the entry; a bump landing after it makes the next read a miss.

An absent tag has an unknown history: it was evicted, or it lapsed after a bump. A read fails closed on it, and a write re-creates it at the CURRENT clock, as if it had just been bumped: every entry still carrying it reads as bumped, and a fill that observed an older clock is refused. The cost is one extra miss per new tag during write traffic: the first fill of a tag the store has never seen, or has lost, is refused when any bump of any tag landed during its read, and the next fill is accepted. A store that loses its clock seeds a fresh one above every value it issued before (the memory driver never loses its clock; the Redis driver seeds from the server time in microseconds).

A driver failure on the read path (`clock`, `read`, `write`) is reported to `onError` and the call falls through to your read; so is a throwing tag derivation, whose value is returned unstored. That covers a store that fails, not one that hangs: a Redis client left at its defaults queues and retries for seconds, so configure it to fail fast (see [@rapiq/cache-redis](https://github.com/tada5hi/rapiq/tree/master/packages/cache-redis)). `invalidate` rethrows, since a lost bump is a correctness problem the caller decides about. An entry ttl that is not a finite number of at least 1 ms throws `CacheError.ttlInvalid`.

## What is not cached

`isCacheable(query)` is `false` when any `Field` carries a `condition`: that is a per-actor visibility verdict the key cannot carry. `rememberQuery` bypasses the cache for such a query. Any read issued while a transaction is open on the connection it reads through must bypass the cache too: it can see that transaction's own uncommitted writes, which a rollback never bumps away, and under REPEATABLE READ its snapshot also predates the clock. Check `queryRunner.isTransactionActive` and call the read directly; on TypeORM's better-sqlite3 driver, which shares one connection, check the shared runner (`dataSource.createQueryRunner().isTransactionActive`).

## The TypeORM write side

`CacheInvalidationSubscriber` derives the same tags for every row TypeORM writes and bumps them AFTER the transaction that wrote them committed. It lives behind its own entry, `@rapiq/cache/typeorm`, so the root types of the package never import from `typeorm` (an optional peer for the types of that entry alone). It imports nothing from `typeorm` at runtime, carries no `@EventSubscriber` decorator, and is registered by pushing an instance onto `dataSource.subscribers` once the DataSource is initialized. `initialize()` rebuilds that array, so push the instance again after every `initialize()` (a `destroy()` followed by `initialize()` drops it silently):

```typescript
import { CacheInvalidationSubscriber } from '@rapiq/cache/typeorm';

await dataSource.initialize();

dataSource.subscribers.push(new CacheInvalidationSubscriber({
    cache,
    registry,
    resolveSchemaName: (metadata) => SCHEMA_NAMES[metadata.name],
    onError: (e) => logger.warn('cache invalidation failed', e),
}));
```

`resolveSchemaName` maps an entity onto its rapiq schema name; `undefined` marks a table the cache does not track. A written row bumps its collection tag, its record tag and a scoped tag for every index-leading column it carries (old and new value on a change, including a foreign key written through a relation object); a soft remove or a recover bumps the row's tags like a remove; an orphan removal with `orphanedRowAction: 'delete'` or `'soft-delete'` reaches the child's row; a removed parent additionally bumps the collections of every entity the database cascades into, transitively, plus a direct child's join column scoped to its key (and to `null` for a SET NULL child); a many-to-many link or unlink bumps the collections of both sides. Inside a transaction the tags collect on the query runner and are bumped once, at the outermost commit; a rolled-back outermost transaction bumps nothing, while a rolled-back savepoint inside a transaction that later commits still bumps its tags (over-invalidation, never stale data). A failed bump is reported to `onError` and never rethrown from a hook. The bump is awaited inside `commitTransaction`, before the pooled connection is released, so a slow cache delays every committing write.

A result scoped by an index-leading filter (`filter[userId]=u1`) carries the scoped tag and its rows' record tags instead of the collection tag, so it is reached by every repository write of a row it holds or of a row carrying that column value, and by a parent removal whose cascade names that column. Scoping applies to the root collection only: every included relation adds its whole collection tag. A scoped result is NOT reached by a pk-less query-builder write to its table (`Repository.update` bumps the collection plus the new scoped values in `values`, never the old ones, and `delete` the collection alone, so even a by-id read stays stale), by a `RelationQueryBuilder.set` / `add` on a many-to-one or one-to-many, by the old scope of an upsert that moves a row, by a one-to-many diff written through the parent without a cascade (the default orphan nullify), by a pk-less delete of a parent (the cascade scoped bump needs the removed row) or by a database-side change that names neither the scoped column nor a loaded row (a cascade on another column or a grandchild); such a result lives until its ttl. A string value scopes only on a column covered by the `caseSensitive` option you pass (exactly what you hand to `adapter.execute`), a date string never scopes, a column the database compares case-insensitively needs canonical filter input, and a decimal column the driver returns as a string must not be scoped on. See the [documentation](https://rapiq.tada5hi.net/guide/cache#what-reaches-a-scoped-reader).

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system (the shared foundation) |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/adapter-sql](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| [@rapiq/adapter-prisma](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-prisma) | Serialize a query into a Prisma argument object |
| [@rapiq/adapter-drizzle](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-drizzle) | Serialize a query into a Drizzle relational query config |
| [@rapiq/adapter-memory](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-memory) | Evaluate a query against in-memory objects & arrays |
| **[@rapiq/cache](https://github.com/tada5hi/rapiq/tree/master/packages/cache)** | Tag-invalidated result cache with a memory driver |
| [@rapiq/cache-redis](https://github.com/tada5hi/rapiq/tree/master/packages/cache-redis) | Redis driver for `@rapiq/cache` |

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/packages/cache).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

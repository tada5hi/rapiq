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
- 🔒 **Race-safe by construction**: the clock is read before the database read and re-checked at store time. A writer committing during the read refuses the entry, one committing after it moves the tags past it, and an evicted tag fails closed.
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

const roles = await rememberQuery(cache, {
    key: `role?${codec.encode(query)}`,
    query,
    schema: 'role',
    registry,
}, () => repository.find(query));
// stored under: role, realm, role:<id>..., realm:<id>...

// the write side, after the transaction committed:
await cache.invalidate(['realm', 'realm:x']);
```

## How a read stays correct

Every driver implements three atomic steps:

```text
write(key, entry, ttl)      refuse when the clock moved below the entry, or any tag was bumped past it
read(key)                   miss when absent, expired, the clock is behind, a tag is missing or bumped past
invalidate(tags)            clock + 1; every tag <- clock
```

`TaggedCache.remember` reads the clock BEFORE it runs your read, and hands that clock to the store together with the value and its tags. A bump landing during the read makes the store refuse the entry; a bump landing after it makes the next read a miss. A tag key exists for every live entry and outlives it, so an absent tag can only mean eviction and reads as a miss, never as "never bumped".

A driver failure on the read path (`clock`, `read`, `write`) is reported to `onError` and the call falls through to your read: a cache outage never takes the application down. `invalidate` rethrows, since a lost bump is a correctness problem the caller decides about.

## What is not cached

`isCacheable(query)` is `false` when any `Field` carries a `condition`: that is a per-actor visibility verdict the key cannot carry. `rememberQuery` bypasses the cache for such a query. A read issued inside a transaction that has already read must bypass the cache too (a REPEATABLE READ snapshot predates the clock the cache observed): check `queryRunner.isTransactionActive` and call the read directly.

## The TypeORM write side

`CacheInvalidationSubscriber` derives the same tags for every row TypeORM writes and bumps them AFTER the transaction that wrote them committed. It lives behind its own entry, `@rapiq/cache/typeorm`, so the root types of the package never import from `typeorm` (an optional peer for the types of that entry alone). It imports nothing from `typeorm` at runtime, carries no `@EventSubscriber` decorator, and is registered by pushing an instance onto `dataSource.subscribers` once the DataSource is initialized:

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

`resolveSchemaName` maps an entity onto its rapiq schema name; `undefined` marks a table the cache does not track. A written row bumps its collection tag, its record tag and a scoped tag for every index-leading column it carries (old and new value on a change); a soft remove or a recover bumps the row's tags like a remove; a removed parent additionally bumps the collections of every entity the database cascades into, transitively, plus a direct child's join column scoped to its key; a many-to-many link or unlink bumps the collections of both sides. Inside a transaction the tags collect on the query runner and are bumped once, at the outermost commit; a rolled-back transaction bumps nothing. A failed bump is reported to `onError` and never rethrown from a hook.

A result scoped by an index-leading filter (`filter[userId]=u1`) carries the scoped tag and its rows' record tags instead of the collection tag, so it is reached by every repository write of a row it holds or of a row carrying that column value, and by a parent removal whose cascade names that column. It is NOT reached by a pk-less query-builder write to its table (`Repository.update` / `delete` hand no row and bump the collection alone, so even a by-id read stays stale), by a pk-less delete of a parent (the cascade scoped bump needs the removed row) or by a database-side change that names neither the scoped column nor a loaded row (a cascade on another column or a grandchild, a `SET NULL`); such a result lives until its ttl. A scoped column must compare byte-exactly: a date string never scopes, and a case-insensitive column needs canonical filter input. See the [documentation](https://rapiq.tada5hi.net/guide/cache#what-reaches-a-scoped-reader).

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

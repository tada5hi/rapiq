<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/cache-redis</h1>

<p align="center">
  <b>Redis driver for <code>@rapiq/cache</code>.</b><br>
  The tag-versioned write, read and invalidate steps as atomic Lua scripts over <code>ioredis</code>,<br>
  so a shared store keeps the same guarantees the memory driver gives one process.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/cache-redis"><img src="https://img.shields.io/npm/v/@rapiq/cache-redis?color=%23a21caf&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/cache-redis"><img src="https://img.shields.io/npm/types/@rapiq/cache-redis?color=%23db2777" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/cache-redis?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/cache-redis"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/cache-redis">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq). Typed REST queries: *build, transport, validate, execute.*
This package implements the `ICacheDriver` contract of [`@rapiq/cache`](https://github.com/tada5hi/rapiq/tree/master/packages/cache) on top of Redis, so several application processes share one tag-invalidated result cache.

- 🔒 **Atomic steps**: the clock read, write, read and invalidate each run as one Lua script (`EVALSHA`, registered once per client through `client.defineCommand`), so two writers racing a tag bump can never leave a tag below the clock.
- 🕰️ **A clock that survives its loss**: a missing clock key is seeded from the server time in microseconds, above every value the lost counter issued, so a flushed or deleted clock cannot make an old entry read as fresh.
- 🏷️ **Same vocabulary**: the tags `@rapiq/cache` derives from a query are the keys this driver versions; nothing is re-derived here.
- 🧩 **Cluster ready**: every script touches several keys, so a cluster deployment gives the driver a hash-tagged prefix (`{rapiq}`) and every key of one store lands in one slot. A cluster prefix without one is refused.

## Installation

```sh
npm install @rapiq/cache @rapiq/cache-redis ioredis
```

`ioredis` (`^5.11.1 || ^6.0.0`) is a peer dependency.

## Usage

```typescript
import Redis from 'ioredis';
import { TaggedCache } from '@rapiq/cache';
import { RedisCacheDriver } from '@rapiq/cache-redis';

const cache = new TaggedCache({
    driver: new RedisCacheDriver({
        client: new Redis(process.env.REDIS_URL, {
            // fail fast: without these, an unreachable Redis stalls every
            // cached read and every committing write for seconds
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            commandTimeout: 300,
        }),
        prefix: 'rapiq',      // default
        maxTtl: 60_000,       // default, in milliseconds
    }),
});
```

The fail-fast options matter on BOTH the read path (`TaggedCache`, `rememberQuery`) and the write path (the TypeORM subscriber). `TaggedCache` falls through to the database when the driver fails, but a default `ioredis` client queues and retries instead of failing: measured against an unreachable Redis, a cached read fell through only after about 10.5 s, and `repository.save` took about 10.5 s (up to 32.5 s once the backoff grows) while holding its pooled connection, since the subscriber bumps inside `commitTransaction`. Without them, a Redis outage can take the application down.

## Keys

| Key | Holds |
|---|---|
| `<prefix>:e:<key>` | one entry: a hash of `clock`, `tags` (JSON) and `value` (JSON), expiring with the entry ttl |
| `<prefix>:t:<tag>` | one tag version, re-armed to `maxTtl` on every write and invalidate |
| `<prefix>:c` | the logical clock, never expiring; seeded from `TIME` in microseconds when absent, so a fresh store's clock is about `1.79e15` |

The value is serialized with `JSON.stringify`, so a `Date` inside a cached row comes back as an ISO string. That is a property of the transport and deliberately not hidden: hydrate dates on the way out, or cache the wire shape.

The read script deletes an entry it can never serve again: the clock key is absent, the clock is below the entry's clock, or the stored tag list fails to decode or holds a non-string.

Prefer `noeviction` or a `volatile-*` `maxmemory-policy`. The time-seeded clock makes a lost clock safe, but never delete the clock key on its own.

## Refused setups

The driver throws a `CacheError` at construction for a client with its own `keyPrefix` option (the read script builds the tag keys itself and would never see it; namespace the store through the driver's `prefix` instead), and for a `Cluster` client whose prefix has no non-empty `{hash tag}` (so the default `rapiq` is refused on a cluster).

## Cluster

Every script touches several keys (the entry, its tags, the clock), which a cluster only allows when they hash to one slot. Give the driver a hash-tagged prefix so every key of one store lands in the same slot:

```typescript
new RedisCacheDriver({ client: cluster, prefix: '{rapiq}' });
```

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
| [@rapiq/cache](https://github.com/tada5hi/rapiq/tree/master/packages/cache) | Tag-invalidated result cache with a memory driver |
| **[@rapiq/cache-redis](https://github.com/tada5hi/rapiq/tree/master/packages/cache-redis)** | Redis driver for `@rapiq/cache` |

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/packages/cache-redis).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

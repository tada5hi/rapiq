# Caching with Redis

`@rapiq/cache-redis` implements the `ICacheDriver` contract of [`@rapiq/cache`](/guide/cache) on top of Redis, so several application processes share one tag-invalidated result cache with the guarantees the memory driver gives one process.

```sh
npm install @rapiq/cache @rapiq/cache-redis ioredis
```

`ioredis` (`^5.11.1 || ^6.0.0`) is a peer dependency: the driver takes the client you already hold.

## Usage

```typescript
import Redis from 'ioredis';
import { TaggedCache } from '@rapiq/cache';
import { RedisCacheDriver } from '@rapiq/cache-redis';

const cache = new TaggedCache({
    driver: new RedisCacheDriver({
        client: new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            commandTimeout: 300,
        }),
        prefix: 'rapiq',
        maxTtl: 60_000,
    }),
});
```

Options:

| Option | Default | Meaning |
|---|---|---|
| `client` | required | an `ioredis` `Redis` or `Cluster` instance, without a `keyPrefix` |
| `prefix` | `rapiq` | the key namespace of this store; a `Cluster` needs a hash tag (`{rapiq}`) |
| `maxTtl` | `60000` | the longest an entry and every tag key may live, in milliseconds |

## Failing fast

`TaggedCache` falls through to the database when the driver FAILS, but a default `ioredis` client does not fail when Redis is unreachable: it queues the command and retries it with a growing backoff. Every cached read then waits that long before it reaches the database, and the TypeORM subscriber, which bumps inside `commitTransaction` while the pooled connection is still held, stalls every committing write the same way. Measured against an unreachable Redis, `repository.save` took about 10.5 s (up to 32.5 s once the reconnect backoff grows), and a cached read fell through after about 10.5 s; with a 10-connection pool, ten concurrent writes exhaust it.

So configure the client to fail fast, for BOTH the read path (`TaggedCache`, `rememberQuery`) and the write path (the subscriber):

| `ioredis` option | Value | Why |
|---|---|---|
| `maxRetriesPerRequest` | `1` | a command fails after one retry instead of twenty |
| `enableOfflineQueue` | `false` | a command issued while disconnected fails at once instead of waiting for a reconnect (so does one issued before the first connection completes; the read path answers it from the database) |
| `commandTimeout` | a few hundred milliseconds, e.g. `300` | a hanging server answers with an error |

Without these options, the claim that a cache outage never takes the application down does not hold: an outage turns into a stall of every request that touches the cache.

## Keys

| Key | Holds |
|---|---|
| `<prefix>:e:<key>` | one entry: a hash of `clock`, `tags` (JSON) and `value` (JSON), expiring with the entry ttl |
| `<prefix>:t:<tag>` | one tag version, re-armed to `maxTtl` on every write and invalidate |
| `<prefix>:c` | the logical clock, never expiring |

The value is serialized with `JSON.stringify`, so a `Date` inside a cached row comes back as an ISO string. That is a property of the transport and deliberately not hidden: hydrate dates on the way out, or cache the wire shape. An `undefined` value is stored as `null`, since JSON has no `undefined`.

The clock is not a small counter. When the store holds none (a fresh store, a flush, a deleted clock key), the driver seeds it on `clock()`, `write` and `invalidate` from the server `TIME` in microseconds (a fresh store's clock is about `1.79e15`), and `clock()` persists that seed. A lost clock key therefore restarts above every value the lost counter issued, assuming fewer than one bump per microsecond on average and no backwards step of the server clock; the value stays below 2^53 for about two centuries. Only the relative step (+1 per `invalidate`) is part of the contract.

The read script deletes an entry it can never serve again: when the clock key is absent, when the clock is below the entry's clock, when the entry's clock is not a finite number, and when the stored tag list is not a JSON array of strings. The write script refuses, before writing anything, an entry clock, ttl or maxTtl that is not a finite integer in range, and a tag list that is not a JSON array.

An entry key that is not well-formed UTF-16 (a lone surrogate) is never cached: `ioredis` encodes it with U+FFFD, so two such keys would share one entry. `read` answers `null`, `write` refuses and `drop` skips it.

## Requirements

Redis 5 or newer. Every script that may seed the clock calls `TIME`, a non-deterministic command; the scripts switch to effects replication first (`redis.replicate_commands()`, a no-op from Redis 7 on).

The default prefix `rapiq` is shared by every driver that does not set one, and two applications on one database would then read and invalidate each other's entries. Give each application its own prefix.

## Eviction

Prefer `noeviction` or a `volatile-*` `maxmemory-policy` for the store's Redis. The clock key carries no TTL, so a `volatile-*` policy never evicts it, while an evicted entry or tag already fails closed. With the `TIME` seed a lost clock is no longer a stale-data risk, but never delete the clock key on its own.

## Refused client setups

The driver refuses two setups at construction with a `CacheError`, since each would disable the cache silently:

- A client with its own `keyPrefix` option (`clientKeyPrefixUnsupported`, code `featureUnsupported`). The read script derives the tag keys from the stored tag list itself, so a client-level prefix would reach the entry and the clock but not the tags. Namespace the store through the driver's `prefix` instead.
- A `Cluster` client whose prefix has no non-empty `{hash tag}` (`prefixHashTagMissing`, code `inputInvalid`). The default prefix `rapiq` is therefore refused on a cluster; see [Cluster](#cluster).

## Atomicity

The clock read and the three contract steps (`write`, `read`, `invalidate`) are four Lua scripts registered once per client through `client.defineCommand` (under names carrying a hash of the script source, `rapiqCacheRead_<hash>`, so two versions of the package sharing one client never run each other's scripts, since `defineCommand` is last-writer-wins per name) and executed with `EVALSHA` (`ioredis` falls back to `EVAL` when the server's script cache was flushed). `write` and `invalidate` receive every key they touch as `KEYS` and the rest as `ARGV`; `read` receives the entry and the clock as `KEYS` and derives the tag keys from the tag list stored with the entry, which is why the entry is a hash rather than one JSON blob: the script decodes the tag list and never the value. A step therefore never splits into round trips: two writers racing an `INCR` followed by a `SET` could otherwise leave a tag at the lower version, and a bump landing between a reader's clock read and its store could go unnoticed.

## Cluster

Every script touches several keys (the entry, its tags, the clock), which a cluster only allows when they hash to one slot. Give the driver a hash-tagged prefix so every key of one store lands in the same slot; a cluster client with a prefix without one is refused:

```typescript
new RedisCacheDriver({ client: cluster, prefix: '{rapiq}' });
```

## Testing

The package runs `@rapiq/cache`'s shared driver contract suite against a live Redis at `REDIS_URL` (default `redis://127.0.0.1:6379`, database 15, flushed before every case). Locally the suite is gated on being able to connect and says so when it skips, the way the TypeORM adapter's engine tests gate on `DB_TYPE`. With `REDIS_REQUIRED` set (CI sets it on the test job) an unreachable Redis FAILS the suite instead of skipping it, so a broken service or a wrong URL cannot turn the job green. The contract's expiry cases reason at millisecond granularity, which a server clock cannot meet without flaking, so the suite runs them against a virtual clock that deletes what Redis would have let lapse; the `PX` and `PEXPIRE` the driver actually sets are asserted through `PTTL` in the driver's own spec.

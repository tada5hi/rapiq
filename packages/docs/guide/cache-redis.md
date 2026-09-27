# Caching with Redis

`@rapiq/cache-redis` implements the `ICacheDriver` contract of [`@rapiq/cache`](/guide/cache) on top of Redis, so several application processes share one tag-invalidated result cache with the guarantees the memory driver gives one process.

```sh
npm install @rapiq/cache @rapiq/cache-redis ioredis
```

`ioredis` (`^5.11.1`) is a peer dependency: the driver takes the client you already hold.

## Usage

```typescript
import Redis from 'ioredis';
import { TaggedCache } from '@rapiq/cache';
import { RedisCacheDriver } from '@rapiq/cache-redis';

const cache = new TaggedCache({
    driver: new RedisCacheDriver({
        client: new Redis(process.env.REDIS_URL),
        prefix: 'rapiq',
        maxTtl: 60_000,
    }),
});
```

Options:

| Option | Default | Meaning |
|---|---|---|
| `client` | required | an `ioredis` `Redis` or `Cluster` instance |
| `prefix` | `rapiq` | the key namespace of this store |
| `maxTtl` | `60000` | the longest an entry and every tag key may live, in milliseconds |

## Keys

| Key | Holds |
|---|---|
| `<prefix>:e:<key>` | one entry: a hash of `clock`, `tags` (JSON) and `value` (JSON), expiring with the entry ttl |
| `<prefix>:t:<tag>` | one tag version, re-armed to `maxTtl` on every write and invalidate |
| `<prefix>:c` | the logical clock, never expiring |

The value is serialized with `JSON.stringify`, so a `Date` inside a cached row comes back as an ISO string. That is a property of the transport and deliberately not hidden: hydrate dates on the way out, or cache the wire shape. An `undefined` value is stored as `null`, since JSON has no `undefined`.

Namespace the store through the driver's `prefix`, not through the client's `keyPrefix` option: the read script derives the tag keys from the stored tag list itself, so a client-level prefix would reach the entry and the clock but not the tags.

## Atomicity

The three contract steps (`write`, `read`, `invalidate`) are three Lua scripts registered once through `client.defineCommand` and executed with `EVALSHA` (`ioredis` falls back to `EVAL` when the server's script cache was flushed). `write` and `invalidate` receive every key they touch as `KEYS` and the rest as `ARGV`; `read` receives the entry and the clock as `KEYS` and derives the tag keys from the tag list stored with the entry, which is why the entry is a hash rather than one JSON blob: the script decodes the tag list and never the value. A step therefore never splits into round trips: two writers racing an `INCR` followed by a `SET` could otherwise leave a tag at the lower version, and a bump landing between a reader's clock read and its store could go unnoticed.

## Cluster

Every script touches several keys (the entry, its tags, the clock), which a cluster only allows when they hash to one slot. Give the driver a hash-tagged prefix so every key of one store lands in the same slot:

```typescript
new RedisCacheDriver({ client: cluster, prefix: '{rapiq}' });
```

## Testing

The package runs `@rapiq/cache`'s shared driver contract suite against a live Redis at `REDIS_URL` (default `redis://127.0.0.1:6379`, database 15, flushed before every case). The suite is gated on being able to connect and says so when it skips, the way the TypeORM adapter's engine tests gate on `DB_TYPE`. The contract's expiry cases reason at millisecond granularity, which a server clock cannot meet without flaking, so the suite runs them against a virtual clock that deletes what Redis would have let lapse; the `PX` and `PEXPIRE` the driver actually sets are asserted through `PTTL` in the driver's own spec.

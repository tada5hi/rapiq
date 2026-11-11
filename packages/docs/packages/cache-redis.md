# @rapiq/cache-redis

::: warning Experimental
`@rapiq/cache-redis` is versioned separately on a `0.x` line: its API may change in any `0.x` minor release, independently of the `2.x` packages. Pin an exact version or a `~` range if you depend on it.
:::

The Redis driver for [@rapiq/cache](/packages/cache): the clock read and the write, read and invalidate steps of the `ICacheDriver` contract as atomic Lua scripts over `ioredis`, so several application processes share one tag-invalidated result cache with the guarantees the memory driver gives one process.

```sh
npm install @rapiq/cache @rapiq/cache-redis ioredis
```

`ioredis` (`^5.11.1 || ^6.0.0`) is a peer dependency: the driver takes the client you already hold. Configure that client to fail fast, or a Redis outage stalls every cached read and every committing write:

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
    }),
});
```

With the offline queue off, a command issued before the first connection is ready rejects, so an invalidation in that window bumps nothing and entries from before a Redis restart stay served until their ttl. Await `ready()` on the driver the cache uses (true once ready, false after a timeout of 1 s by default; it never rejects) before the first read or write, and do not start serving on `false`. See [waiting for the connection](/guide/cache-redis#waiting-for-the-connection).

The options, failing fast, the key layout, the time-seeded clock, the eviction policy, the JSON serialization of values, the refused client setups (a client `keyPrefix`, a cluster prefix without a hash tag) and the cluster setup (a hash-tagged prefix such as `{rapiq}`) are covered in the [Caching with Redis](/guide/cache-redis) guide.

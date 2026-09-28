# @rapiq/cache-redis

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

The options, failing fast, the key layout, the time-seeded clock, the eviction policy, the JSON serialization of values, the refused client setups (a client `keyPrefix`, a cluster prefix without a hash tag) and the cluster setup (a hash-tagged prefix such as `{rapiq}`) are covered in the [Caching with Redis](/guide/cache-redis) guide.

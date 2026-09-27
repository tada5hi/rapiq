# @rapiq/cache-redis

The Redis driver for [@rapiq/cache](/packages/cache): the write, read and invalidate steps of the `ICacheDriver` contract as atomic Lua scripts over `ioredis`, so several application processes share one tag-invalidated result cache with the guarantees the memory driver gives one process.

```sh
npm install @rapiq/cache @rapiq/cache-redis ioredis
```

`ioredis` is a peer dependency: the driver takes the client you already hold.

```typescript
import Redis from 'ioredis';
import { TaggedCache } from '@rapiq/cache';
import { RedisCacheDriver } from '@rapiq/cache-redis';

const cache = new TaggedCache({
    driver: new RedisCacheDriver({ client: new Redis(process.env.REDIS_URL) }),
});
```

The options, the key layout, the JSON serialization of values and the cluster setup (a hash-tagged prefix such as `{rapiq}`) are covered in the [Caching with Redis](/guide/cache-redis) guide.

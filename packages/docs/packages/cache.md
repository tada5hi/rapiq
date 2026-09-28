# @rapiq/cache

A tag-invalidated result cache for rapiq queries. A cached result depends on every row it holds and on the membership of the sets it selected from, so a stored value carries **tags** (a collection, a scope, a record), every tag has a **version** on one logical clock, and a write bumps the tags it owns. A read whose entry carries a bumped tag is a miss.

```sh
npm install @rapiq/core @rapiq/cache
```

The full walkthrough is the [Caching Query Results](/guide/cache) guide.

## What's inside

| Area | Exports | Guide |
|---|---|---|
| **Cache** | `TaggedCache` (`remember`, `invalidate`, `drop`), `ITaggedCache` | [Reading through the cache](/guide/cache#reading-through-the-cache) |
| **Tags** | `buildCollectionTag`, `buildRecordTag`, `buildScopedTag`, `isScopedTagValue` | [Vocabulary](/guide/cache#vocabulary) |
| **Query tags** | `collectQueryTags`, `isCacheable`, `rememberQuery`, `QueryTagsInput`, `RememberQueryInput`, `QueryCaseSensitive` | [Which tags a query yields](/guide/cache#which-tags-a-query-yields) |
| **Drivers** | `ICacheDriver`, `CacheEntry`, `MemoryCacheDriver`, `CACHE_MAX_TTL_DEFAULT`, `isCacheTtlValid`, `clampCacheTtl`, `isCacheTagWellFormed` | [The driver contract](/guide/cache#the-driver-contract) |
| **Errors** | `CacheError`, `isCacheError` | [Errors](/guide/cache#errors) |

The cache key is the caller's, and it must encode every input that selects the result: the executed query, `fields`, and every path parameter (the `:id` of `GET /roles/:id`). See [the cache key](/guide/cache#the-cache-key). A string filter value scopes only when `caseSensitive` carries exactly what you pass to `adapter.execute(query, { caseSensitive })`.

## The TypeORM write side

`CacheInvalidationSubscriber` bumps the tags of every row TypeORM writes, after the transaction that wrote it committed. It is its own entry, so the root types never import from `typeorm`:

```typescript
import { CacheInvalidationSubscriber } from '@rapiq/cache/typeorm';
```

`typeorm` is an optional peer dependency for the types of that entry alone; the class imports nothing from `typeorm` at runtime. Push the instance onto `dataSource.subscribers` after every `initialize()`. See [The TypeORM write side](/guide/cache#the-typeorm-write-side) and [what reaches a scoped reader](/guide/cache#what-reaches-a-scoped-reader).

## Shared stores

The memory driver serves one process. For a store shared between processes use [@rapiq/cache-redis](/packages/cache-redis), which implements the same `ICacheDriver` contract and runs the same contract suite.

# Caching Query Results

`@rapiq/cache` stores the result of a [`Query`](/guide/query-ast) and invalidates it by **tags**: names for every collection, scope and record the result depends on, each carrying a version on one logical clock. A write bumps the tags it owns; a read whose entry carries a bumped tag is a miss.

```sh
npm install @rapiq/core @rapiq/cache
```

For a store shared between processes add [`@rapiq/cache-redis`](/guide/cache-redis).

## Why tags and versions

A cached result depends on every row it contains and on the membership of the sets it selected from. A key per value cannot express that: `roles?include=realm` changes when a role is renamed, when a role is added, and when the realm a role points at is renamed, and none of those writes knows the key.

So a value carries tags, and a tag is a **version** rather than a set of keys. A `tag -> keys` index grows without bound and needs a sweeper; normalizing the result into per-row entries re-implements relation hydration. A number per tag needs neither. The shape is the one BentoCache and Next.js' `revalidateTag` use, minus their dependence on the wall clock.

## Vocabulary

Three tag shapes, derived from the rapiq schema NAME (`Schema.name`) on both the reading and the writing side:

| Tag | Example | Meaning |
|---|---|---|
| `buildCollectionTag(schema)` | `role` | any result selected from the rows of `role` |
| `buildRecordTag(schema, id)` | `role:7` | any result containing the row with id `7` |
| `buildScopedTag(schema, column, value)` | `userRole:userId=u1` | any result selected by that column value |

A scoped value is `String(value)`, `null` spelled `null`; only string, number, boolean and null values ever produce a scoped tag.

A scoped tag rests on one assumption: the database treats two values of the column as equal exactly when their `String()` spellings are equal, so the value a reader filtered on is byte for byte the value the writer's row carries. A reader scoped on a spelling the writer never produces is not reached by any bump of that column. Two cases the package handles or cannot:

- **Dates.** A filter value that parses as an ISO-8601 date (`toDate` from `@rapiq/core`) never scopes: the reader holds the string the wire carried while the writer's row holds a `Date` (which produces no scoped tag) or the database's storage form. Such a conjunct keeps the collection tag.
- **Case-insensitive comparison.** A `*_ci` collation (the MySQL default), a postgres `citext` column and a postgres `uuid` (whose input is case-insensitive) all match `Master` against a stored `master`, while the tags do not. Canonicalize such a value before it reaches the query (lowercase a uuid, the way the writer stores it); a filter carrying another spelling leaves the result stale until its ttl.

## Reading through the cache

```typescript
import { defineQuery, SchemaRegistry } from '@rapiq/core';
import { MemoryCacheDriver, TaggedCache, rememberQuery } from '@rapiq/cache';

const cache = new TaggedCache({
    driver: new MemoryCacheDriver({ maxTtl: 60_000 }),
    ttl: 30_000,
    onError: (e) => logger.warn('cache unavailable', e),
});

const query = defineQuery<Role>({ relations: ['realm'] });

const roles = await rememberQuery(cache, {
    key: `role?${codec.encode(query)}`,
    query,
    schema: 'role',
    registry,
}, () => repository.find(query));
```

`rememberQuery` decides whether the query may be shared (`isCacheable`), then hands the read to `TaggedCache.remember` with a tag derivation over the hydrated result. The cache KEY is yours: a codec-encoded query plus the schema name is the natural one, and this package does not encode queries itself.

`remember` on a miss reads the clock, runs your read, derives the tags from the value and stores `{ clock, tags, value }`. The value is returned whether or not the store accepted it. A driver failure on `clock`, `read` or `write` is reported to `onError` (default: dropped) and the call falls through to your read; a cache outage must never take the application down.

### Which tags a query yields

`collectQueryTags({ query, schema, registry, value, key? })` emits, deduplicated and in this order:

1. **The root collection dependency.** The top-level conjuncts of the root filters are inspected (a non-preserved `AND` is flattened; any other root is one non-scoping conjunct). A conjunct that is an `eq` or `in` on an undotted column that LEADS a declared index (`schema.indexes`) with scalar value(s) emits a scoped tag per value, so `filter[userId]=u1` on `userRole` yields `userRole:userId=u1` instead of `userRole`. If no conjunct qualified, the collection tag is emitted. Both sides derive "index-leading" from the same schema, which is what lets the writer's scoped bump reach exactly the readers it should.
2. **Relation collection dependencies.** Every path in `query.relations`, and every dotted path in a filter field, a sort key or a field key, is walked from the root schema through `schema.mapSchema(segment)` and the registry, emitting the collection tag of every schema on the way. An unresolvable segment throws a `CacheError`: a schema the registry lacks is a configuration error, not a miss.
3. **Record dependencies.** Every root row's `row[key]` (default `id`) becomes a record tag, and every relation path is followed on the rows (a segment may hold an object or an array) emitting a record tag for every row reached, at every level of the path. A row without the key property emits nothing.

```typescript
collectQueryTags({
    query: defineQuery<Role>({ relations: ['realm'] }),
    schema: 'role',
    registry,
    value: [{ id: 'r1', realm: { id: 'x' } }],
});
// ['role', 'realm', 'role:r1', 'realm:x']
```

### What is not cached

`isCacheable(query)` is `false` when any `Field`, at the root or under a relation, carries a `condition`. That is a per-actor visibility verdict a schema hook attached (see [field conditions](/guide/fields)): the projection depends on who asked, which the key cannot carry. `rememberQuery` calls the read directly for such a query.

A read issued inside a transaction that has already read must bypass the cache too: a `REPEATABLE READ` snapshot predates the clock the cache observed, so a value read from it could be stored as current. Check `queryRunner.isTransactionActive` (or your driver's equivalent) and call the read directly.

## Invalidating

```typescript
await cache.invalidate(['role', 'role:7', 'role:realmId=x']);
```

The write side derives the same names: the collection tag always (a rename can move a row into a name-keyed result), the record tag from the row's id, and a scoped tag for every index-leading column present on the row (both the old and the new value when it changed). Bump AFTER the transaction committed: a bump inside it is only a hint, since a reader can still read the pre-commit rows and store them with a clock the bump predates.

`invalidate` rethrows a driver failure, because a lost bump is a correctness problem the caller decides about. `drop(keys)` removes entries by key and rethrows likewise.

## The TypeORM write side

`CacheInvalidationSubscriber` is the write side for TypeORM: it derives the tags of every written row the way the reading side derives them, and bumps them after the transaction that wrote the row committed.

```typescript
import { CacheInvalidationSubscriber } from '@rapiq/cache/typeorm';

const dataSource = new DataSource({ /* ... */ });
await dataSource.initialize();

dataSource.subscribers.push(new CacheInvalidationSubscriber({
    cache,
    registry,
    resolveSchemaName: (metadata) => SCHEMA_NAMES[metadata.name],
    onError: (e) => logger.warn('cache invalidation failed', e),
}));
```

The write side lives behind its own entry, `@rapiq/cache/typeorm`, so the root types of `@rapiq/cache` never import from `typeorm`: a consumer without TypeORM (a Redis-backed reader, say) type-checks with no `skipLibCheck`. `typeorm` is an optional peer dependency for the types of that entry alone; the class carries no `@EventSubscriber` decorator and imports nothing from `typeorm` at runtime, so it is registered by pushing an instance onto `dataSource.subscribers` **after** `initialize()`: the `subscribers` option only instantiates decorated classes and drops an instance, and `initialize()` replaces the array.

| Option | Meaning |
|---|---|
| `cache` | anything with `invalidate(tags)`, usually the `TaggedCache` |
| `registry` | the `SchemaRegistry` the reading side uses; the scoped tags come from the same `indexes` |
| `resolveSchemaName` | `(metadata) => string \| undefined`: the rapiq schema name of an entity, `undefined` for an untracked table |
| `onError` | where a failed bump is reported (default: dropped) |

### Which tags a write bumps

For a row of an entity mapped onto schema `s`:

- `buildCollectionTag(s)` always: a rename can move a row into a name-keyed result, and updates must reach collection readers too.
- `buildRecordTag(s, id)` when the row carries its primary key (a composite key joins its values with `:`).
- `buildScopedTag(s, column, value)` for every column that leads an index of `registry.get(s)` and is present on the row. An update bumps the old AND the new value of such a column, from `databaseEntity` and `entity`.
- A removed parent additionally bumps the collection tag of every child entity whose relation onto it declares `onDelete: 'CASCADE'` or `'SET NULL'`, plus the scoped tag of the join column where it leads an index on the child (`role:realmId=x` when realm `x` goes): the database changes those child rows without firing a hook. The walk is transitive: a CASCADE-deleted child's own CASCADE and SET NULL children change too, so removing a realm also bumps `userRole` when `userRole` cascades from `role` and `role` from `realm`. A SET NULL edge ends the walk, since that child survives. Only a direct child gets the scoped join-column tag; deeper down the value its join column held is not in hand, so a grandchild is reached through its collection alone.
- A many-to-many link or unlink writes the junction table only, and TypeORM fires the hook on the junction metadata alone. The subscriber maps the junction onto both owning entities and bumps both collection tags, since a reader that included the relation carries the collection of the side it reached. A repository `save` and `RelationQueryBuilder.add` hand the join values, which adds the two record tags; `RelationQueryBuilder.remove` hands nothing and yields the two collections.
- A soft remove and a recover (`softRemove` / `recover`, and the criteria forms `softDelete` / `restore`) bump the row's own tags like a remove does, since the row leaves or re-enters every result. No cascade tags: they are an update of the delete-date column, and the database cascades nothing on an update.

A payload without a primary key yields the collection tag alone: `Repository.update(criteria, values)` hands the subscriber only the values, `Repository.delete(criteria)` (and `softDelete` / `restore`) nothing at all.

### What reaches a scoped reader

A result whose root filter scoped the collection (`filter[userId]=u1` on `userRole`) carries `userRole:userId=u1` and the record tags of the rows it holds, and NOT the collection tag `userRole`: that replacement is what keeps a write to another user's rows from invalidating it. The price is that a bump which can only name the collection does not reach it. Concretely, a scoped reader IS reached by:

- a repository write (`save`, `remove`, `softRemove`, `recover`) of a row it holds, through that row's record tag;
- a repository write of any row carrying the scoped column value, through the scoped tag (`userRole:userId=u1`), the old and the new value on a change;
- a parent removal whose cascade names the scoped column: removing role `r1` bumps `userRole:roleId=r1`, so a reader scoped on `roleId=r1` refetches.

It is NOT reached by:

- a pk-less query-builder write to its table: `Repository.update(criteria, values)` and `Repository.delete(criteria)` hand no row, so they bump the collection tag alone, and EVERY scoped result of that table stays in place until it expires. That includes the by-id read: `id` leads an index, so `filter[id]=r1` is scoped to `role:id=r1` plus `role:r1`, and `roles.update({ id: 'r1' }, values)` bumps only `role`. Load and `save` the row when that matters;
- a pk-less delete of a PARENT (`Repository.delete(criteria)` on `role`): the cascade scoped bump needs the removed row's key in hand, so the child collection `userRole` is bumped but `userRole:roleId=r1` is not, and a reader scoped on `roleId=r1` keeps serving rows the database cascaded away;
- a database-side change that names neither the scoped column nor a loaded row: the cascade above deletes `ur1` without a hook, so a reader scoped on `userId=u1` that holds `ur1` keeps serving it, a grandchild cascade bumps no scoped tag at all, and a realm removal that SET NULLs `role.realmId` never bumps `role:realmId=null`.

Both are bounded by the entry ttl. Where a table takes such writes, keep its ttl short, or route the write through the repository so the row's tags are in hand.

### When the bump happens

Inside a transaction the tags collect on the query runner (`queryRunner.data`) and are bumped once, at the outermost commit; a released savepoint bumps nothing yet, and a rolled-back transaction bumps nothing at all. A write outside a transaction bumps at once. The bump after commit is what makes the model correct: a reader can still see the pre-commit rows while the transaction is open, and a bump inside it would let that reader store them with a clock the bump predates.

A failed bump is reported to `onError` and never rethrown from a hook, since a hook failure would fail the request after its write committed.

## The driver contract

`ICacheDriver` is three atomic steps and a `maxTtl`:

```text
write(key, entry, ttl):                  ONE atomic step
    ttl = min(ttl, maxTtl)
    clock <- 0 if absent
    for tag in entry.tags: tag <- 0 if absent; tag ttl <- maxTtl (re-armed on every write)
    if clock < entry.clock -> false      (the clock was lost and restarted)
    if any tag version > entry.clock -> false   (a bump landed during the read)
    store entry with ttl -> true

read(key):                               ONE atomic step
    entry absent or expired -> null
    clock absent or clock < entry.clock -> null
    any tag absent -> null               (eviction or flush is a miss, never "never bumped")
    any tag version > entry.clock -> null
    -> entry

invalidate(tags):                        ONE atomic step
    c = clock + 1 (clock <- c)
    for tag in tags: tag <- c, ttl maxTtl
```

Each line answers a counter-example. The version is read before the database read and re-checked at store, so a writer committing during the read refuses the entry and one committing after bumps past it. A tag key exists for every live entry and outlives it (`maxTtl` is at least every entry ttl), so absence can only be eviction and fails closed. A restarted counter is caught by `clock < entry.clock`. None of the three steps may be split into round trips, because two writers racing an increment followed by a set can leave a tag at the LOWER version.

`MemoryCacheDriver` (zero dependencies) implements the contract in-process: a `Map` of entries, a `Map` of tag versions, a clock. Expiry is lazy plus a bounded prune on every write. `read` hands out a copy, so a caller can never mutate the store through a hit, and the stored value is a `structuredClone` of what the read returned: a class instance (a TypeORM entity) comes back as a plain object with its prototype, methods, getters and `instanceof` gone, while a `Date`, a `Map` or a nested array survives. A value holding a function cannot be cloned at all: the write fails, is reported to `onError`, and the read is served from the source every time. The Redis driver has the JSON equivalent of the same effects, so the advice is the same for both: cache the wire shape, not the entity. Options: `{ maxTtl?: number }`, default one minute.

The semantics are pinned by one shared contract suite that every driver runs against; `@rapiq/cache-redis` runs the same file against a live Redis.

## Errors

`CacheError` extends `@rapiq/core`'s `BaseError` and carries its codes (`schemaUnresolvable`, `schemaNameInvalid`). It is raised for configuration failures only, never for a miss or an outage; recognise it with `isCacheError`, which survives a second copy of the package and a JSON round trip.

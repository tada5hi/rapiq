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

Only a string, a number, a boolean, a valid `Date` or `null` produces a scoped tag (`isScopedTagValue`); an object, an array, an invalid `Date` and `undefined` never do. The spelling is canonical so the types a database treats as equal meet: a string or a number is `String(value)`, `null` is `null`, a boolean is `1` or `0` and a `Date` is its epoch milliseconds (`getTime()`). A filter carrying `1` on a boolean column, or a numeric epoch on a datetime column, therefore meets the writer's row. On the writing side a date column (a `Date` type, or a column type starting with `date`, `datetime` or `timestamp`) written as a string is parsed and spelled like the `Date` it stores; a date-only column (`YYYY-MM-DD`) is spelled as UTC midnight, so an epoch filter meets it only when it names UTC midnight too. Within one column `true` and `1` (and `false` and `0`) share a tag, which can only over-invalidate.

A scoped tag rests on one assumption: the database treats two values of the column as equal exactly when their canonical spellings are equal, so the value a reader filtered on is byte for byte the value the writer's row carries. A reader scoped on a spelling the writer never produces is not reached by any bump of that column. The cases the package handles, and the ones it cannot:

- **Date strings.** A filter value that parses as an ISO-8601 date (`toDate` from `@rapiq/core`) never scopes: the reader holds the string the wire carried while the writer's row holds a `Date` (spelled as its epoch) or the database's storage form. Such a conjunct keeps the collection tag. A `Date` object in the filter scopes, on both sides.
- **Case sensitivity.** An adapter folds every string `eq` / `in` (compares it case-insensitively) unless it is told otherwise through `adapter.execute(query, { caseSensitive })`, so `filter[name]=Master` matches a row holding `master`, whose write bumps `realm:name=master`. `collectQueryTags` and `rememberQuery` therefore take `caseSensitive?: string[] | boolean` (the type is exported as `QueryCaseSensitive`): pass exactly the value you hand to `adapter.execute`. `true` means every field, a list names root fields. A string filter value scopes only on a column the option covers. Without the option (the default) no string ever scopes, because the adapter folds every string unless the option is forwarded. The schema's `filters.caseSensitive` list has no effect on its own: it matters only once it is forwarded to `execute()`. Numbers, booleans, dates and `null` scope regardless.
- **Case-insensitive storage.** A column executed case-sensitively can still compare case-insensitively in the database: a `*_ci` collation (the MySQL default), a postgres `citext` column and a postgres `uuid` (whose input is case-insensitive) all match `Master` against a stored `master`, while the tags do not. Canonicalize such a value before it reaches the query (lowercase a uuid, the way the writer stores it); a filter carrying another spelling leaves the result stale until its ttl.
- **Numbers stored as strings.** A decimal or numeric column that the driver returns as a string (postgres `numeric` hands back `'5.00'` for a filter value `5`) is spelled differently on the two sides. Do not scope on such a column: keep it from leading a declared index used for scoping, or filter it as a string on a case-sensitive column only when the stored spelling is canonical. MySQL's numeric cast of a varchar (`'01' = 1`) belongs to the same class.

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
    caseSensitive: ['id', 'realmId'],
}, () => adapter.execute(query, { caseSensitive: ['id', 'realmId'] }));
```

`rememberQuery` decides whether the query may be shared (`isCacheable`), then hands the read to `TaggedCache.remember` with a tag derivation over the hydrated result.

### The cache key

The KEY is yours, and this package does not encode queries itself. It must encode every input that selects the result: the query as EXECUTED (encode it after the server appended its own conditions, not the query the client sent), the `fields` parameter (a key built from the filters alone serves the wrong projection), and every input that lives outside the query, above all a path parameter. `GET /roles/:id?include=realm` carries its id in the path, so a key made of the encoded query alone is shared by every id and serves the first id's row to every later request. The same holds for a route realm (`/realms/:realmId/...`):

```typescript
const roles = await rememberQuery(cache, {
    key: `role/${id}?${codec.encode(query)}`,
    query,
    schema: 'role',
    registry,
}, () => repository.findOne({ where: { id }, relations: { realm: true } }));
```

A path id kept out of the filters leaves the read unscoped, so it keeps the root collection tag and is reached by every write to the table. Moving it into the query as `filter[id]` scopes the read (`role:id=r1`), with the blind spots listed under [what reaches a scoped reader](#what-reaches-a-scoped-reader).

### `remember`

`remember` on a miss reads the clock, runs your read, derives the tags from the value and stores `{ clock, tags, value }`. The value is returned whether or not the store accepted it. A driver failure on `clock`, `read` or `write` is reported to `onError` (default: dropped) and the call falls through to your read. The same goes for a throwing `tags` derivation (for example the `CacheError` `collectQueryTags` raises for an unregistered include target): it is reported to `onError` and the value is returned UNSTORED, since the database read already succeeded. A write whose tags include one that is not well-formed UTF-16 (a lone surrogate, see `isCacheTagWellFormed`) is refused by both drivers and nothing is stored.

That fall-through keeps a failing store off the result, not off the clock: a driver that hangs instead of failing delays every miss by as long as it hangs. For Redis, configure the client to fail fast (see [the Redis guide](/guide/cache-redis#failing-fast)); without that, a Redis outage can stall every request.

Concurrent misses of one key are not coalesced (there is no single-flight): after a bump of a hot tag, every concurrent reader goes to the database.

The entry ttl is the default `ttl` of the `TaggedCache` or a per-call `ttl`, both in milliseconds and clamped by the driver to its `maxTtl`. A ttl that is not a finite number of at least 1 ms (`Number(process.env.UNSET)` is `NaN`) throws `CacheError.ttlInvalid`: at construction for the default, per `remember` call (before the read) for a per-call one. `isCacheTtlValid` is the check and `clampCacheTtl` the clamp a driver applies; a driver handed a non-finite or sub-millisecond ttl directly takes it as `maxTtl`.

### Which tags a query yields

`collectQueryTags({ query, schema, registry, value, rows?, primaryKey?, caseSensitive? })` emits, deduplicated and in this order:

1. **The root collection dependency.** The top-level conjuncts of the root filters are inspected (a non-preserved `AND` is flattened; any other root is one non-scoping conjunct). A conjunct that is an `eq` or `in` on an undotted column that LEADS a declared index (`schema.indexes`) with scopable value(s) emits a scoped tag per value (a string only on a column `caseSensitive` covers, see above), so `filter[userId]=u1` on `userRole` yields `userRole:userId=u1` instead of `userRole`. If no conjunct qualified, the collection tag is emitted. Both sides derive "index-leading" from the same schema, which is what lets the writer's scoped bump reach exactly the readers it should. Scoping applies to the root collection only.
2. **Relation collection dependencies.** Every path in `query.relations`, every dotted path in a filter field, a sort key or a field key, and every relation a filter is applied to itself (`elemMatch`, and any operator whose field names a registered relation, such as `size` or `all`) is walked from the root schema through `schema.mapSchema(segment)` and the registry, emitting the collection tag of every schema on the way. The keys of an `elemMatch` interior resolve against the relation, so `elemMatch(realm, eq(owner.name, ...))` adds `realm` and `user`; an `elemMatch` on a scalar or JSON array adds nothing. An unresolvable segment throws a `CacheError`: a schema the registry lacks is a configuration error, not a miss. The same holds for an `elemMatch` on a relation the schema declares under `relations.allowed` whose target schema is not registered (core accepts it and the adapter joins it, so naming no dependency would serve it stale). Inside `remember` the throw is reported to `onError` and the value is returned unstored.
3. **Record dependencies.** Every root row's primary key (`primaryKey`, default `id`) becomes a record tag, and every included relation path is followed on the rows (a segment may hold an object or an array) emitting a record tag for every row reached, at every level of the path. A row without the key property emits nothing.

The rows are read from the value as a row, rows, `null` or an empty array. A tuple (`findAndCount`'s `[rows, total]`) or an envelope (`{ data, meta }`) yields NO record tags unless you unwrap it with `rows`, e.g. `rows: ([rows]) => rows` or `rows: (value) => value.data`; the extractor feeds the root rows and every included relation walked from them. `QueryTagsInput<T>` and `RememberQueryInput<T>` are both generic over the read value, so the extractor is typed.

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

Any read issued while a transaction is open on the connection it reads through must bypass the cache as well, not only a transaction that has already read. It can see that transaction's own uncommitted writes, which a rollback never bumps away, so the rolled-back row would be served to every caller until the ttl; and under `REPEATABLE READ` its snapshot also predates the clock the cache observed. Check `queryRunner.isTransactionActive` (or your driver's equivalent) and call the read directly. TypeORM's better-sqlite3 driver shares one connection between every request, so there the check is the shared runner (`dataSource.createQueryRunner().isTransactionActive`), not the caller's own: a request outside any transaction still reads another request's uncommitted write.

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

The write side lives behind its own entry, `@rapiq/cache/typeorm`, so the root types of `@rapiq/cache` never import from `typeorm`: a consumer without TypeORM (a Redis-backed reader, say) type-checks with no `skipLibCheck`. `typeorm` is an optional peer dependency for the types of that entry alone; the class carries no `@EventSubscriber` decorator and imports nothing from `typeorm` at runtime, so it is registered by pushing an instance onto `dataSource.subscribers` **after** `initialize()`: the `subscribers` option only instantiates decorated classes and drops an instance, and `initialize()` rebuilds the array from the options. The same holds for every later `initialize()`: `dataSource.destroy()` followed by `initialize()` drops the pushed subscriber silently, so push the instance again after every `initialize()` (a reconnect path, a test harness).

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
- `buildScopedTag(s, column, value)` for every column that leads an index of `registry.get(s)` and is present on the row. An update bumps the old AND the new value of such a column, from `databaseEntity` and `entity`. A foreign key written through a relation object (`Repository.insert({ realm: { id } })`, `insert().values({ realm: { id } })`, `update().set({ realm: { id } })` or `set({ realm: null })`) bumps the join column's scoped tag as well.
- A removed parent additionally bumps the collection tag of every child entity whose relation onto it declares `onDelete: 'CASCADE'` or `'SET NULL'`, plus the scoped tag of the join column where it leads an index on the child (`role:realmId=x` when realm `x` goes), and for a SET NULL child also the `null` scope (`note:realmId=null`), which the orphaned rows move into: the database changes those child rows without firing a hook. The walk is transitive: a CASCADE-deleted child's own CASCADE and SET NULL children change too, so removing a realm also bumps `userRole` when `userRole` cascades from `role` and `role` from `realm`. A SET NULL edge ends the walk, since that child survives. Only a direct child gets the scoped join-column tag; deeper down the value its join column held is not in hand, so a grandchild is reached through its collection alone. A criteria delete of the parent (`realms.delete({ id: 'x' })`) bumps a SET NULL child's `null` scope too, but not its join-column scope for the old parent key, because the criteria hands no key.
- Orphan removal: with `orphanedRowAction: 'delete'` or `'soft-delete'`, removing a child from its parent's one-to-many list and saving the parent reaches the child's record tag and id scope, and for `'delete'` also the cascade scoped tags (`userRole:roleId=r1`). The subscriber names the row from `event.entityId`, which is the key alone: the OLD parent scope (`role:realmId=x`) is not bumped, so counts and later pages of that scope that did not hold the row stay stale until their ttl.
- An insert that omits a nullable column without a default writes `NULL`, and bumps that column's `null` scope although the payload does not name it.
- A partial `save({ id, name })` can bump a nullable column's `null` scope the row does not actually move into: TypeORM writes `null` for the omitted relation onto the payload it hands the hook. Over-invalidation only.
- A many-to-many link or unlink writes the junction table only, and TypeORM fires the hook on the junction metadata alone. The subscriber maps the junction onto both owning entities and bumps both collection tags, since a reader that included the relation carries the collection of the side it reached. A repository `save` and `RelationQueryBuilder.add` hand the join values, which adds the two record tags; `RelationQueryBuilder.remove` hands nothing and yields the two collections.
- A soft remove and a recover (`softRemove` / `recover`, and the criteria forms `softDelete` / `restore`) bump the row's own tags like a remove does, since the row leaves or re-enters every result. No cascade tags: they are an update of the delete-date column, and the database cascades nothing on an update.

A payload without a primary key names no row: `Repository.update(criteria, values)` bumps the collection plus the NEW scoped values carried in `values`, never the old ones; `Repository.delete(criteria)` (and `softDelete` / `restore`) bumps the collection tag alone.

### What reaches a scoped reader

A result whose root filter scoped the collection (`filter[userId]=u1` on `userRole`) carries `userRole:userId=u1` and the record tags of the rows it holds, and NOT the collection tag `userRole`: that replacement is what keeps a write to another user's rows from invalidating it. The price is that a bump which can only name the collection does not reach it.

Scoping applies to the root collection only. Every included or otherwise reached relation adds its WHOLE collection tag, so any write to an included table (any role, in any realm) invalidates every result that includes it, however the root is scoped.

A scoped reader IS reached by:

- a repository write (`save`, `remove`, `softRemove`, `recover`) of a row it holds, through that row's record tag;
- a repository write of any row carrying the scoped column value, through the scoped tag (`userRole:userId=u1`), the old and the new value on a change;
- a parent removal whose cascade names the scoped column: removing role `r1` bumps `userRole:roleId=r1`, so a reader scoped on `roleId=r1` refetches;
- a one-to-many bind through the parent that cascades (`cascade: true`), and an orphan removal with `orphanedRowAction: 'delete'` or `'soft-delete'` for a reader that held the row or is scoped on its id (not for other readers of the old parent scope, see above).

It is NOT reached by:

- a pk-less query-builder write to its table: `Repository.update(criteria, values)` and `Repository.delete(criteria)` hand no row, so they bump no record tag and no old scope, and a scoped result holding the row stays in place until it expires. That includes the by-id read: `id` leads an index, so `filter[id]=r1` is scoped to `role:id=r1` plus `role:r1`, and `roles.update({ id: 'r1' }, values)` does not reach it. The same holds for every QueryBuilder `update()`, including `update().whereEntity(e)` and `returning()`. Load and `save` the row when that matters;
- a `RelationQueryBuilder.set` / `add` on a many-to-one or one-to-many, where the row is named only by `.of(id)`;
- the OLD scope of an upsert that moves a row between scopes: `Repository.upsert` and `insert().orUpdate()` fire `afterInsert` with no `databaseEntity`, so only the NEW scope is bumped, and readers of the old scope that do not hold the row (later pages, counts, totals) stay stale. Load and `save` when a scoped column can change;
- a one-to-many diff written through the parent without a cascade, i.e. the default `orphanedRowAction: 'nullify'` and a bind like `realmRepo.save({ id: 'y', roles: [{ id: 'r1' }] })`: TypeORM's `UpdateEvent` carries no identifier, so the subscriber cannot name the row. Only the child collection tag and the `null` scope of each nullable index-leading join column are bumped. That reaches readers of the destination of an orphan nullify; by-id readers, readers of the old scope and readers of a bind's new non-null scope stay stale. Save the child from the many-to-one side, or use `orphanedRowAction: 'delete'`. An upstream TypeORM change adding `UpdateEvent.entityId` (as `InsertEvent` and `RemoveEvent` carry) would close this;
- a pk-less delete of a PARENT (`Repository.delete(criteria)` on `role`): the cascade scoped bump needs the removed row's key in hand, so the child collection `userRole` is bumped but `userRole:roleId=r1` is not, and a reader scoped on `roleId=r1` keeps serving rows the database cascaded away;
- a database-side change that names neither the scoped column nor a loaded row: the cascade above deletes `ur1` without a hook, so a reader scoped on `userId=u1` that holds `ur1` keeps serving it, a grandchild cascade bumps no scoped tag at all, and a SET NULL two levels down bumps no `null` scope (only a direct child's join column is in hand).

All of them are bounded by the entry ttl. Where a table takes such writes, keep its ttl short, or route the write through the repository so the row's tags are in hand.

### When the bump happens

Inside a transaction the tags collect on the query runner (`queryRunner.data`) and are bumped once, at the outermost commit; a released savepoint bumps nothing yet. A write outside a transaction bumps at once. The bump after commit is what makes the model correct: a reader can still see the pre-commit rows while the transaction is open, and a bump inside it would let that reader store them with a clock the bump predates.

A rolled-back outermost transaction bumps nothing, including on better-sqlite3's shared query runner and on a reused manual `QueryRunner`. A rolled-back SAVEPOINT inside a transaction that later commits still bumps its tags at the outer commit; that is harmless over-invalidation, never stale data.

The subscriber awaits `cache.invalidate` inside `afterTransactionCommit`, which TypeORM runs inside `commitTransaction`, before the query runner (a pooled connection on postgres and mysql) is released. A slow or unreachable cache therefore delays every committing write and holds its database connection for the whole stall. With a default `ioredis` client against an unreachable Redis, `repository.save` took about 10.5 s (up to 32.5 s once the reconnect backoff grows), and a cached read fell through to the database only after about 10.5 s; with a 10-connection pool, ten concurrent writes exhaust it. Configure the Redis client to fail fast on both the read and the write path (see [the Redis guide](/guide/cache-redis#failing-fast)).

A failed bump is reported to `onError` and never rethrown from a hook, since a hook failure would fail the request after its write committed.

## The driver contract

`ICacheDriver` is a clock read, three atomic steps and a `maxTtl`:

```text
write(key, entry, ttl):                  ONE atomic step
    ttl = maxTtl if ttl is not finite or below 1, else min(ttl, maxTtl)
    any tag not well-formed UTF-16 -> false     (checked before anything is written)
    clock <- seed if absent
    for tag in entry.tags: tag <- clock if absent; tag ttl <- maxTtl (re-armed on every write)
    if clock < entry.clock -> false             (the clock was lost and restarted)
    if any tag version > entry.clock -> false   (a bump landed during the read)
    store entry with ttl -> true

read(key):                               ONE atomic step
    entry absent or expired -> null
    clock absent or clock < entry.clock -> null
    any tag absent -> null                      (an unknown history is a miss, never "never bumped")
    any tag version > entry.clock -> null
    -> entry

invalidate(tags):                        ONE atomic step
    c = (clock, or seed if absent) + 1; clock <- c
    for tag in tags: tag <- c, ttl maxTtl
```

Each line answers a counter-example. The version is read before the database read and re-checked at store, so a writer committing during the read refuses the entry and one committing after bumps past it. None of the three steps may be split into round trips, because two writers racing an increment followed by a set can leave a tag at the LOWER version.

An absent tag has an unknown history: it was evicted, or it lapsed after a bump. A read fails closed on it, and a write re-creates it at the CURRENT clock, never at 0, as if it had just been bumped. Every entry still carrying it then reads as bumped, and a fill that observed an older clock is refused. The accepted cost: the first fill of a tag the store has never seen, or has lost, is refused when any bump of any tag landed while that fill was reading. The next fill is accepted, so it costs one extra miss per new tag during write traffic.

The seed is what a store answers for a clock it does not hold. `MemoryCacheDriver` seeds 0, since its clock is never lost. The Redis driver seeds a clock it does not hold (on `clock()`, `write` and `invalidate`) from the server `TIME` in microseconds, so a lost clock key restarts above every value the lost counter issued, assuming fewer than one bump per microsecond on average and no backwards step of the server clock; the value stays below 2^53 for about two centuries. Clock values are therefore not small counters on Redis: only the relative step (+1 per `invalidate`) is part of the contract.

`MemoryCacheDriver` (zero dependencies) implements the contract in-process: a `Map` of entries, a `Map` of tag versions, a clock. Expiry is lazy plus a prune on every write and invalidate: a bounded scan of at most `MEMORY_CACHE_PRUNE_BUDGET` (16) entries, and every expired tag from the front of the tag map, which is kept in expiry order. The tag prune is amortized O(1) per inserted tag and keeps the tag map bounded by the live tags. `read` hands out a copy, so a caller can never mutate the store through a hit, and the stored value is a `structuredClone` of what the read returned: a class instance (a TypeORM entity) comes back as a plain object with its prototype, methods, getters and `instanceof` gone, while a `Date`, a `Map` or a nested array survives. A value holding a function cannot be cloned at all: the write fails, is reported to `onError`, and the read is served from the source every time. The Redis driver has the JSON equivalent of the same effects, so the advice is the same for both: cache the wire shape, not the entity. Options: `{ maxTtl?: number }`, default one minute.

The semantics are pinned by one shared contract suite that every driver runs against; `@rapiq/cache-redis` runs the same file against a live Redis.

## Errors

`CacheError` extends `@rapiq/core`'s `BaseError` and carries its codes. It is raised for configuration failures only, never for a miss or an outage; recognise it with `isCacheError`, which survives a second copy of the package and a JSON round trip.

| Factory | Code | Raised when |
|---|---|---|
| `schemaUnresolvable`, `relationUnresolvable` | `schemaUnresolvable` | the root schema, or a relation segment, is not in the registry |
| `schemaNameUndefined` | `schemaNameInvalid` | a schema without a name (the name is the vocabulary) |
| `maxTtlInvalid` | `inputInvalid` | a driver `maxTtl` that is not a finite number of at least 1 ms |
| `ttlInvalid` | `inputInvalid` | an entry ttl that is not a finite number of at least 1 ms |
| `clientKeyPrefixUnsupported` | `featureUnsupported` | a Redis client with its own `keyPrefix` |
| `prefixHashTagMissing` | `inputInvalid` | a Redis `Cluster` client whose driver prefix carries no hash tag |

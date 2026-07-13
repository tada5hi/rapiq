# Merging & Composition

Real queries rarely come from one place. A list view combines **user input** (a search box), **component state** (the current page), **props** (a parent-imposed scope) and **application defaults** — and the server may add conditions of its own. rapiq composes all of these on the `Query` itself, so every construction path (built, decoded, parsed by any dialect) combines the same way.

## `mergeQueries` — left priority

```typescript
import { mergeQueries } from '@rapiq/core';

const query = mergeQueries(searchQuery, paginationQuery, propsQuery, defaultsQuery);
```

The first argument wins conflicts. All operations are **immutable**: inputs stay untouched, new instances are returned — safe for reactivity systems and shared default fragments.

Per-parameter semantics:

| Parameter | Rule |
|---|---|
| `fields` / `relations` / `sorts` | keyed by name, left-priority replace; order = first occurrence |
| `pagination` | per-property left priority (`limit` and `offset` merge independently) |
| `filters` | per-field replace via `Filters.merge` — see below |

## Filters: two explicit operations

Filters get two distinct operations, because a single "merge" would silently break one of the two use cases.

### `merge()` — per-field replace

A condition on a field **replaces** the other side's conditions on the same field (it is *not* and-ed). This is the list-view case: user search input overrides a default on the same field, while unrelated defaults survive:

```typescript
const searchQ = defineQuery<User>({ filters: { name: { $contains: input } } });
const defaultsQ = defineQuery<User>({ filters: { name: 'John', age: { $gte: 18 } } });

mergeQueries(searchQ, defaultsQ).filters;
// name contains <input> (from searchQ), age >= 18 (from defaultsQ)
```

`merge()` is only defined when **both sides are flat root-AND trees** (leaf conditions only). Anything else throws a `MergeError` (`ErrorCode.FILTERS_NOT_FLAT`) instead of guessing:

```typescript
mergeQueries(flatQ, defineQuery({ filters: or(...) })); // throws MergeError
```

An empty side passes the other side through unchanged — compound defaults survive as long as nothing needs replacing.

### `and()` / `or()` — wrap & inject

Always defined, for combining condition trees. The receiver is wrapped as a child of a new group, so injected conditions become part of the tree rather than candidates for replacement:

```typescript
import { Query, eq } from '@rapiq/core';

// server-side, after parsing client input:
const scoped = new Query({
    ...query,
    filters: query.filters.and(eq('realm_id', actor.realmId)),
});
```

The adapter output now contains the injected condition regardless of what the client sent — and since the wrapped tree is no longer flat, a later `merge()` throws instead of silently displacing the scoping condition. That failure mode is a feature: injected security conditions cannot be merged away. See the [authorization recipe](/guide/recipes/authorization).

## Why not deep-merge input objects?

Generic object merging (smob, deepmerge, spread) on query *input* cannot express these semantics — same-field replace, null-preserving `in` arrays, injected conditions that resist displacement. Merge on the query instead: build fragments with [`defineQuery` / `define*`](/guide/building-queries#fragments), compose with `mergeQueries`, then encode or execute the result.

## Next steps

- [Recipes: Type-safe frontend queries](/guide/recipes/frontend) — merging user input, props and defaults in a list view.
- [Recipes: Authorization & scoping](/guide/recipes/authorization) — `and()` injection end-to-end.

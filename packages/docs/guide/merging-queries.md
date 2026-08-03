# Merging & Composition

Real queries rarely come from one place. A list view combines **user input** (a search box), **component state** (the current page), **props** (a parent-imposed scope) and **application defaults**, and the server may add conditions of its own. rapiq composes all of these on the `Query` itself, so every construction path (built, decoded, parsed by any dialect) combines the same way.

## `mergeQueries`: left priority

```typescript
import { mergeQueries } from '@rapiq/core';

const query = mergeQueries(searchQuery, paginationQuery, propsQuery, defaultsQuery);
```

The first argument wins conflicts. All operations are **immutable**: inputs stay untouched and new instances are returned, safe for reactivity systems and shared default fragments.

Per-parameter semantics:

| Parameter | Rule |
|---|---|
| `fields` / `relations` / `sorts` | keyed by name, left-priority replace; order = first occurrence |
| `pagination` | per-property left priority (`limit` and `offset` merge independently) |
| `filters` | per-field replace via `Filters.merge` (see below) |

One guard applies to `fields`: a name collision that would discard a [row-scoped visibility gate](/guide/fields#row-scoped-fields) (`Field.condition`) throws a `MergeError` (`ErrorCode.FIELDS_CONDITION_DISCARDED`) instead of silently un-gating the column. A gate only ever arises server-side, from a schema hook; keep that parsed query as the receiver and its gates survive every collision.

## Filters: two explicit operations

Filters get two distinct operations, because a single "merge" would silently break one of the two use cases.

### `merge()`: per-field replace

A condition on a field **replaces** the other side's conditions on the same field (it is *not* and-ed). This is the list-view case: user search input overrides a default on the same field, while unrelated defaults survive:

```typescript
const searchQ = defineQuery<User>({ filters: { name: { $contains: input } } });
const defaultsQ = defineQuery<User>({ filters: { name: 'John', age: { $gte: 18 } } });

mergeQueries(searchQ, defaultsQ).filters;
// name contains <input> (from searchQ), age >= 18 (from defaultsQ)
```

Replacement applies to the **displaceable root conditions** of both sides: the leaf conditions directly under a root `and`. Everything else is inert, carried through as it is and combined with `and`:

| Conjunct | Behavior in a merge |
|---|---|
| root-level leaf condition | replaced by a receiver condition on the same field |
| [sealed](#seal-conditions-that-resist-replacement) condition | never replaced, always carried through |
| nested group (`or(...)`, `not(...)`, a whole non-`and` root) | never replaced, always carried through as one conjunct |

```typescript
mergeQueries(flatQ, defineQuery({ filters: or(gte('age', 18), eq('email', null)) })).filters;
// and( <flatQ conditions>, or(age >= 18, email = null) )
```

Per-field replace has no sound reading inside a disjunction: dropping a condition there would change the group non-locally, keeping it would ignore receiver priority. So the group is and-ed in untouched, which makes `merge()` **total**: it never throws. Every conjunct of the receiver survives into the result, so a merge never returns anything wider than its receiver; only the other side can lose conditions, and only to same-field replacement. Widening stays the explicit operation, `or()` below.

An empty side passes the other side through unchanged.

### `seal`: conditions that resist replacement

A **sealed** condition is never displaced by a merge and never collapsed into its parent group by `flatten()`. It is what `and()` / `or()` apply to everything they inject, and it is available on its own:

```typescript
import { eq, seal } from '@rapiq/core';

const scope = seal(eq('realm_id', actor.realmId));
```

Sealing is immutable (a sealed copy is returned) and idempotent. It is a **server-side composition marker, not wire grammar**: a sealed condition that is encoded to a URL and decoded again comes back displaceable, which is why a receiving service re-injects its own scope instead of trusting the transport.

The marker protects the whole subtree it heads, and it holds during parsing too: the [relations gate](/guide/relations#validate-hooks), which drops every key traversing a rejected relation, cannot silently prune a condition out of a sealed group. A rejected relation that a sealed condition needs throws `SchemaError` (`ErrorCode.SCHEMA_SEALED_CONDITION_PRUNED`) instead.

### `and()` / `or()`: wrap & inject

Always defined, for combining condition trees. The injected conditions are sealed, so they are part of the tree rather than candidates for replacement. A receiver already carrying that operator contributes its own conditions to the group (which keeps them mergeable); anything else becomes a child of the new group. Calling `and()` / `or()` with no conditions returns the receiver unchanged.

```typescript
import { Query, eq } from '@rapiq/core';

// server-side, after parsing client input:
const scoped = new Query({
    ...query,
    filters: query.filters.and(eq('realm_id', actor.realmId)),
});
```

The adapter output now contains the injected condition regardless of what the client sent, even when the client sent no filters at all. And because the injected condition is sealed, no later composition can drop it: a `merge()` carries it through and a client condition on the same field narrows within it, while `flatten()` and any other normalization leave the marker intact. That guarantee is unconditional, and it is a feature: injected security conditions cannot be merged away. See the [authorization recipe](/guide/recipes/authorization).

## Why not deep-merge input objects?

Generic object merging (smob, deepmerge, spread) on query *input* cannot express these semantics: same-field replace, null-preserving `in` arrays, injected conditions that resist displacement. Merge on the query instead: build fragments with [`defineQuery` / `define*`](/guide/building-queries#fragments), compose with `mergeQueries`, then encode or execute the result.

## Next steps

- [Recipes: Type-safe frontend queries](/guide/recipes/frontend): merging user input, props and defaults in a list view.
- [Recipes: Authorization & scoping](/guide/recipes/authorization): `and()` injection end-to-end.

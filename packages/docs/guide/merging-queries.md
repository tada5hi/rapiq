# Merging & Composition

Real queries rarely come from one place. A list view combines user input, component state, parent scope and application defaults. rapiq composes these values on the `Query` itself, so built, decoded and parsed queries follow the same rules.

## `mergeQueries`: left priority where keys conflict

```typescript
import { mergeQueries } from '@rapiq/core';

const query = mergeQueries(searchQuery, paginationQuery, propsQuery, defaultsQuery);
```

All operations are immutable. Inputs stay untouched and the result is a new query when composition changes it.

Per-parameter semantics:

| Parameter | Rule |
|---|---|
| `fields` / `relations` / `sorts` | keyed left priority |
| `pagination` | per-property left priority (`limit` and `offset` merge independently) |
| `filters` | ordered logical AND; every predicate survives |

For fields, a name collision that would discard a [row-scoped visibility gate](/guide/fields#row-scoped-fields) (`Field.condition`) throws `MergeError` (`ErrorCode.FIELDS_CONDITION_DISCARDED`) instead of silently un-gating the column.

## Filters: monotonic conjunction

`Filters.merge()` and `mergeQueries()` combine filters as an ordered logical AND. No predicate is replaced, including conditions on the same field:

```typescript
const clientQuery = defineQuery<User>({ filters: { age: { $gte: 18 } } });
const serverQuery = defineQuery<User>({ filters: { age: { $lt: 65 } } });

mergeQueries(clientQuery, serverQuery).filters;
// and(age >= 18, age < 65)
```

The receiver's non-preserved root `and` is flattened into its conjuncts. A preserved root, an `or(...)` or `not(...)` root remains one conjunct, so its meaning stays intact. An empty side passes the other side through unchanged.

This monotonic rule is useful for server scope: a client condition on `realm_id` can only narrow the server's `realm_id` condition, never widen or remove it.

Complete queries are never OR-composed. When a filter needs alternatives, express them inside the filter tree with `or(...)`:

```typescript
import { defineQuery, eq, gte, or } from '@rapiq/core';

const query = defineQuery<User>({
    filters: or(gte('age', 18), eq('status', 'admin')),
});
```

### Replacing UI state

`mergeQueries` deliberately does not provide replacement semantics for filters. Replace transient UI state before building the query, or select the current filters node before query composition:

```typescript
const currentSearch = search.length > 0 ?
    { name: { $contains: search } } :
    undefined;

const userQuery = defineQuery<User>({ filters: currentSearch });
const query = mergeQueries(userQuery, parentScope, defaults);
```

For state already represented as AST nodes, choose the current `IFilters` value before query composition. For example, select the current filters against the defaults, then pass only the selected node to `defineQuery`:

```typescript
const defaultFilters = defineFilters<User>({ age: { $gte: 18 } });
const currentFilters = search ?
    defineFilters<User>({ name: { $contains: search } }) :
    undefined;
const selectedFilters = currentFilters ?? defaultFilters;

const query = mergeQueries(
    defineQuery<User>({ filters: selectedFilters }),
    parentScope,
    defaults,
);
```

Putting `currentFilters` and `defaultFilters` in separate queries passed to `mergeQueries` would conjunct them. It does not replace the default. Selecting the current node first makes replacement a UI-state decision rather than a hidden query-composition rule.

### `and()` / `or()`: build a condition tree

`and()` and `or()` wrap condition trees immutably. Calling either method with no conditions returns the receiver unchanged.

```typescript
import { Query, eq } from '@rapiq/core';

const scoped = new Query({
    ...query,
    filters: query.filters.and(eq('realm_id', actor.realmId)),
});
```

The scope is part of the resulting AND tree regardless of client input. A later query merge adds more conjuncts, so security scopes cannot be merged away.

## Preservation is for relation pruning

`preserve()` is not a merge or override tool. It marks a built-in condition subtree for the relation-pruning policy. If a relation validator rejects a relation that a preserved condition needs, parsing raises `SchemaError` (`ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED`) rather than silently changing the policy's meaning.

Use it for a validator residual that must remain intact, and preserve the residual only:

```typescript
import { and, inArray, preserve } from '@rapiq/core';

return and(filter, preserve(inArray('realm_id', actor.realmIds)));
```

Do not preserve the group containing the client filter. The client leaf must remain eligible for relation pruning; preserving only the server residual keeps the error reserved for a genuine contradiction in the residual itself. See [Relations](/guide/relations#validate-hooks) and [Authorization](/guide/recipes/authorization#scoping-server-conditions).

## Why not deep-merge input objects?

Generic object merging cannot express the AST rules: keyed left priority for fields, relations and sorts; per-property pagination; and ordered conjunction for filters. Build fragments with [`defineQuery` / `define*`](/guide/building-queries#fragments), compose them with `mergeQueries`, then encode or execute the result.

## Next steps

- [Recipes: Type-safe frontend queries](/guide/recipes/frontend): UI state, scope and defaults.
- [Recipes: Authorization & scoping](/guide/recipes/authorization): server conditions and validator residuals.

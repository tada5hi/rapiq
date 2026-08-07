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

### `mergeFiltersInput`: per-field replace, before the query

Overriding a default on the same field is a real need, and it belongs to the **input**, before a `Query` exists. `mergeFiltersInput` composes [filter build input](/guide/building-queries#filters) with per-field replace: the first input to constrain a field wins it, and every field only one side constrains survives.

```typescript
import { defineQuery, mergeFiltersInput, mergeQueries } from '@rapiq/core';

const query = mergeQueries(
    defineQuery<User>({
        filters: mergeFiltersInput<User>(
            search ? { name: { $contains: search } } : {},  // user input wins
            { name: 'John', age: { $gte: 18 } },            // component defaults
        ),
    }),
    parentScope,
);
// name contains <search>, age >= 18
```

Replacement is per **field**, not per operator: `{ age: { $gte: 18 } }` beating `{ age: { $lt: 65 } }` yields the lower bound alone. Keeping both is conjunction, which is what merging two queries does. An `undefined` value claims no field, so a later input still supplies it, and a `$elemMatch` interior is one value, replaced whole.

Because both [notations](/guide/building-queries#filters) address the same fields, inputs are reduced to canonical dotted paths first. That is the difference from an object spread, which sees only keys:

```typescript
// spread: two conditions on one field, and a lost sibling default
{ ...{ 'realm.name': 'a', 'realm.id': 1 }, ...{ realm: { name: 'b' } } }
// -> realm.name = 'a' AND realm.name = 'b'   (realm.id survives by luck)
{ ...{ realm: { name: 'a', id: 1 } }, ...{ realm: { name: 'b' } } }
// -> realm.name = 'b'                        (realm.id silently gone)

mergeFiltersInput<User>({ realm: { name: 'b' } }, { realm: { name: 'a', id: 1 } });
// -> { 'realm.name': 'b', 'realm.id': 1 }
```

The result is the flat notation, itself valid input for `defineFilters` or another merge.

::: tip Why replace is safe here and not on the query
`mergeFiltersInput` accepts build input only. Passing a condition (`eq(...)`, `and(...)`) is a type error and throws at runtime. A build input is plain data and can never carry a server-authored scope, so per-field replace cannot displace one. That is exactly what it could do on the IR, which is why [`Filters.merge`](#filters-monotonic-conjunction) is conjunction instead.
:::

### Replacing a whole filters node

When the alternatives are already AST nodes, select between them before query composition. Select between the values **one control** can hold:

```typescript
// a status control: `defaultStatus` is what it shows until the user picks.
const defaultStatus = defineFilters<User>({ status: 'active' });
const currentStatus = status ?
    defineFilters<User>({ status }) :
    undefined;

const query = mergeQueries(
    defineQuery<User>({ filters: currentStatus ?? defaultStatus }),
    parentScope,
    defaults,
);
```

Putting `currentStatus` and `defaultStatus` in separate queries passed to `mergeQueries` would conjunct them. It does not replace the default.

::: warning Select between alternatives, never across them
Both branches of the selection must answer the same question. A baseline on an unrelated field is not an alternative to a status choice: fold `age >= 18` into `defaultStatus` and it disappears the moment the user touches the control. Keep such a baseline in its own query, where it merges in unconditionally, or express the override with `mergeFiltersInput` above, which is per field and has no such trap.
:::

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

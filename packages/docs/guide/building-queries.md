# Building Queries

`defineQuery` builds a [`Query`](/guide/query-ast) directly from typed input: no string round-trip, no parsing, no schema. It is the caller-side entry point: construct the query, hand it to the [URL codec](/guide/wire) for transport, or to an [adapter](/guide/executing-queries) directly.

```typescript
import { defineQuery } from '@rapiq/core';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { name: { $contains: 'jo' }, 'realm.id': [1, null] },
    relations: ['realm'],
    sorts: '-created_at',
    pagination: { limit: 10 },
});
```

Supplying a record generic (`defineQuery<User>`) types every field path (`'realm.name'`, …) with autocomplete; without one, plain strings are accepted.

The input types recurse through nested records up to a default depth of 5. For self-recursive record types (`type Category = { children: Category[] }`) the inferred input type can outgrow what the compiler will serialize; pass an explicit depth as the second generic to bound it: `defineQuery<Category, 2>(...)`, `QueryBuildInput<Category, 2>`.

::: info No validation here
The build layer constructs the query verbatim. What a client *may* request is decided on the receiving side, where parsers validate against a [Schema](/guide/schemas). Keeping the two concerns apart is deliberate: the caller doesn't need the schema, and the receiver never trusts the caller.
:::

::: warning Unknown keys are rejected
`defineQuery` and `defineSchema` throw on a top-level key they do not
recognise, rather than dropping it. A dropped filter key would produce an
empty query, which downstream means unfiltered data rather than no data.
The URL wire names get a pointer at the right key: `filter` suggests
`filters`, `page` and `limit` suggest `pagination`, `include` suggests
`relations`.
:::

## Filters

Four equivalent notations, freely mixable:

| Notation | Example | Meaning |
|---|---|---|
| scalar | `{ name: 'John' }` | equals |
| bare array | `{ 'realm.id': [1, null] }` | *in* list; `null` is a legal element and backends rewrite it to `… OR IS NULL` |
| operator object | `{ age: { $gte: 18, $lt: 65 } }` | explicit operators, combined with **and** |
| condition helpers | `or(gte('age', 18), eq('deleted_at', null))` | arbitrary condition trees |

Multiple keys combine with **and** (a flat root-AND). A relation reads either fully nested (`{ realm: { name: 'master' } }`) or as a dot-path (`{ 'realm.name': 'master' }`); the two are interchangeable but not mixable within one key (write `{ 'realm.x.y': v }`, not `{ realm: { 'x.y': v } }`); keeping them disjoint bounds the inferred input type for deeply/cyclically related records. A bare `RegExp` value builds a `regex` condition.

### Operator objects

One key per [filter operator](/guide/filters#operators), prefixed with `$`:

`$eq` `$ne` `$lt` `$lte` `$gt` `$gte` `$in` `$nin` `$startsWith` `$notStartsWith` `$endsWith` `$notEndsWith` `$contains` `$notContains` `$regex` `$mod` `$size` `$exists` `$elemMatch`

Most take the field's value type (`$eq`/`$ne` also accept `null`, `$in`/`$nin` take arrays, the string operators take strings). The remaining value shapes:

```typescript
defineQuery<User>({
    filters: {
        name: { $regex: /^jo/i },              // RegExp or pattern string
        age: { $mod: [4, 0] },                 // [divisor, remainder]
        tags: { $size: 2 },                    // array length
        email: { $exists: true },              // boolean
        items: {                               // match array elements;
            $elemMatch: { name: 'chess' },     // field paths are relative
        },                                     // to the element
        scores: {                              // element-level operators
            $elemMatch: { $gt: 5 },            // apply to the element
        },                                     // itself (ITSELF marker)
    },
});
```

Operator keys that are present but `undefined` are skipped: conditional spreads like `{ $contains: search || undefined }` simply contribute no condition. Unknown `$` keys throw a `BuildError` (`ErrorCode.OPERATOR_UNSUPPORTED`); input is never guessed at.

::: warning Reserved: `$and` / `$or`
Compound object keys belong to the [MongoDB-style parser dialect](/packages/parser-mongo) and are deliberately **not** part of the build layer. Compound trees are written with the condition helpers instead: `filters: or(...)`.
:::

### Condition helpers

Typed constructors for single conditions and compound trees: one per operator, mirroring the [expression dialect](/packages/parser-expression) one-to-one (`eq('name', 'John')` in code ≙ `eq(name, 'John')` on the wire):

```typescript
import { and, eq, gte, inArray, or } from '@rapiq/core';

const query = defineQuery<User>({
    filters: and(
        eq('name', 'John'),
        or(gte('age', 18), eq('deleted_at', null)),
    ),
});
```

`eq` `ne` `lt` `lte` `gt` `gte` `inArray` `nin` `startsWith` `notStartsWith` `endsWith` `notEndsWith` `contains` `notContains` `regex` `mod` `size` `exists` `elemMatch`, plus the `and` / `or` / `not` compounds. `not(condition)` is the exact complement of its interior (see [Negation](/guide/filters#negation)); multiple arguments negate their conjunction. Use [`preserve()`](/guide/merging-queries#preservation-is-for-relation-pruning) only when a relation-pruning policy must retain a server-authored residual.

#### Custom conditions

```typescript
import { CONDITION_MARKER, Condition, and, eq } from '@rapiq/core';

class GeoCondition extends Condition<[number, number]> {
    constructor(value: [number, number]) {
        super('geo', value);
    }
}

const filters = and(
    eq('active', true),
    new GeoCondition([52.52, 13.405]),
);
```

`ICondition` is open and structural: extending `Condition` supplies the live-condition marker, but a custom class may instead implement `ICondition` with `readonly [CONDITION_MARKER] = true`. A condition must have the marker, an `operator`, and a `value`; detached serialized data is not a live condition. Visitor dispatch is optional. A custom condition may expose its own visitor contract when useful, and it needs a parser, adapter, or other consumer that understands its semantics. Built-in adapters intentionally reject unknown condition kinds.

Use `isCondition(value)` to recognize the shared live contract. `isFilter(value)` and `isFilters(value)` deliberately identify only the built-in leaf and group kinds.

A few helpers deviate from the uniform `(field, value)` signature:

```typescript
mod('age', 4, 0);                    // (field, divisor, remainder)
size('tags', 2);                     // (field, length): array length
exists('email');                     // (field, value = true)
elemMatch('items', eq('name', 'x')); // (field, condition): condition
                                     // field paths are element-relative
elemMatch('scores', gt(ITSELF, 5));  // ITSELF addresses the element
                                     // itself (scalar arrays)
```

::: info `inArray`
`in` is a reserved word in JavaScript, so the `IN` helper is named `inArray`. On the wire (expression dialect) the keyword stays `in`; `nin` is unaffected.
:::

Like `defineQuery`, every helper accepts a record generic for typed field paths: `eq<User>('realm.name', 'master')`.

::: warning Compound trees on the wire
The URL codec writes the [expression dialect](/packages/codec-url#expression-dialect) by default, so `or(...)` and nested groups cross the boundary intact. Only the deprecated simple writer is limited to flat root-AND filters. Operators without a URL grammar still throw rather than silently changing semantics. See [Queries over the Wire](/guide/wire#what-fits-on-the-wire).
:::

## Other parameters

| Parameter | Input forms |
|---|---|
| `fields` | array of keys with optional `+`/`-` prefix (`['id', '+email', '-password']`), per-relation record (`{ realm: ['id'] }`), or tuple `[keys, record]`; see [Fields](/guide/fields) |
| `sorts` | key with optional `-` prefix (`'-created_at'`), array of such keys, or record (`{ created_at: 'DESC', realm: { name: 'ASC' } }`); see [Sort](/guide/sort) |
| `relations` | dot-path names (`['realm', 'items.user']`) or record (`{ realm: true, items: { user: true } }`); see [Relations](/guide/relations) |
| `pagination` | `{ limit?, offset? }`; see [Pagination](/guide/pagination) |

## Fragments

Each parameter has its own factory (`defineFields`, `defineFilters`, `definePagination`, `defineRelations`, `defineSorts`) returning a fragment that assigns directly into `defineQuery` input. Useful when query parts travel as data (props, composables, function arguments) before being assembled:

```typescript
import { defineFilters, defineQuery } from '@rapiq/core';

const scope = defineFilters<User>({ realm_id: id });

const query = defineQuery<User>({
    filters: scope,          // fragments assign without casts
    pagination: { limit: 10 },
});
```

Fragments and raw input mix freely; already-built AST nodes pass through unchanged.

To override a filter default on the same field, compose the *input* with [`mergeFiltersInput`](/guide/merging-queries#mergefiltersinput-per-field-replace-before-the-query) before it becomes a fragment. It replaces per field, where an object spread would emit both notations of one field and eat a nested sibling default.

## Next steps

- [Merging & Composition](/guide/merging-queries): combining queries from multiple sources.
- [Queries over the Wire](/guide/wire): encoding what you built.
- [Recipes: Type-safe frontend queries](/guide/recipes/frontend): fragments and merging in a real list view.

# Building Queries

`defineQuery` builds a [`Query`](/guide/query-ast) directly from typed input — no string round-trip, no parsing, no schema. It is the caller-side entry point: construct the query, hand it to the [URL codec](/guide/wire) for transport, or to an [adapter](/guide/executing-queries) directly.

```typescript
import { defineQuery } from '@rapiq/core';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { name: { $contains: 'jo' }, 'realm.id': [1, null] },
    relations: ['realm'],
    sort: '-created_at',
    pagination: { limit: 10 },
});
```

Supplying a record generic (`defineQuery<User>`) types every field path (`'realm.name'`, …) with autocomplete; without one, plain strings are accepted.

::: info No validation here
The build layer constructs the query verbatim. What a client *may* request is decided on the receiving side, where parsers validate against a [Schema](/guide/schemas). Keeping the two concerns apart is deliberate: the caller doesn't need the schema, and the receiver never trusts the caller.
:::

## Filters

Four equivalent notations, freely mixable:

| Notation | Example | Meaning |
|---|---|---|
| scalar | `{ name: 'John' }` | equals |
| bare array | `{ 'realm.id': [1, null] }` | *in* list — `null` is a legal element; backends rewrite it to `… OR IS NULL` |
| operator object | `{ age: { $gte: 18, $lt: 65 } }` | explicit operators, combined with **and** |
| condition helpers | `or(gte('age', 18), eq('deleted_at', null))` | arbitrary condition trees |

Multiple keys combine with **and** (a flat root-AND). Nested records (`{ realm: { name: 'master' } }`) and dot-paths (`{ 'realm.name': 'master' }`) are interchangeable. A bare `RegExp` value builds a `regex` condition.

### Operator objects

One key per [filter operator](/guide/filters#operators), prefixed with `$`:

`$eq` `$ne` `$lt` `$lte` `$gt` `$gte` `$in` `$nin` `$startsWith` `$notStartsWith` `$endsWith` `$notEndsWith` `$contains` `$notContains` `$regex` `$mod` `$exists` `$elemMatch`

Most take the field's value type (`$eq`/`$ne` also accept `null`, `$in`/`$nin` take arrays, the string operators take strings). The remaining value shapes:

```typescript
defineQuery<User>({
    filters: {
        name: { $regex: /^jo/i },              // RegExp or pattern string
        age: { $mod: [4, 0] },                 // [divisor, remainder]
        email: { $exists: true },              // boolean
        items: {                               // match array elements;
            $elemMatch: { name: 'chess' },     // field paths are relative
        },                                     // to the element
    },
});
```

Operator keys that are present but `undefined` are skipped — conditional spreads like `{ $contains: search || undefined }` simply contribute no condition. Unknown `$` keys throw a `BuildError` (`ErrorCode.OPERATOR_UNSUPPORTED`) — input is never guessed at.

::: warning Reserved: `$and` / `$or`
Compound object keys belong to the [MongoDB-style parser dialect](/packages/parser-mongo) and are deliberately **not** part of the build layer. Compound trees are written with the condition helpers instead: `filters: or(...)`.
:::

### Condition helpers

Typed constructors for single conditions and compound trees — one per operator, mirroring the [expression dialect](/packages/parser-expression) one-to-one (`eq('name', 'John')` in code ≙ `eq(name, 'John')` on the wire):

```typescript
import { and, eq, gte, inArray, or } from '@rapiq/core';

const query = defineQuery<User>({
    filters: and(
        eq('name', 'John'),
        or(gte('age', 18), eq('deleted_at', null)),
    ),
});
```

`eq` `ne` `lt` `lte` `gt` `gte` `inArray` `nin` `startsWith` `notStartsWith` `endsWith` `notEndsWith` `contains` `notContains` `regex` `mod` `exists` `elemMatch` — plus `and` / `or` compounds.

Three helpers deviate from the uniform `(field, value)` signature:

```typescript
mod('age', 4, 0);                    // (field, divisor, remainder)
exists('email');                     // (field, value = true)
elemMatch('items', eq('name', 'x')); // (field, condition) — condition
                                     // field paths are element-relative
```

::: info `inArray`
`in` is a reserved word in JavaScript, so the `IN` helper is named `inArray`. On the wire (expression dialect) the keyword stays `in`; `nin` is unaffected.
:::

Like `defineQuery`, every helper accepts a record generic for typed field paths: `eq<User>('realm.name', 'master')`.

::: warning Compound trees on the wire
The simple URL dialect can only express **flat root-AND** filter sets. Encoding a query with `or(...)` or nested groups throws a typed error instead of silently flattening — use the [expression codec](/packages/codec-url-expression) when compound trees must cross the URL boundary. Adapters consume compound trees natively. See [Queries over the Wire](/guide/wire#what-fits-on-the-wire).
:::

## Other parameters

| Parameter | Input forms |
|---|---|
| `fields` | array of keys with optional `+`/`-` prefix (`['id', '+email', '-password']`), per-relation record (`{ realm: ['id'] }`), or tuple `[keys, record]` — see [Fields](/guide/fields) |
| `sort` | key with optional `-` prefix (`'-created_at'`), array of such keys, or record (`{ created_at: 'DESC', realm: { name: 'ASC' } }`) — see [Sort](/guide/sort) |
| `relations` | dot-path names (`['realm', 'items.user']`) or record (`{ realm: true, items: { user: true } }`) — see [Relations](/guide/relations) |
| `pagination` | `{ limit?, offset? }` — see [Pagination](/guide/pagination) |

## Fragments

Each parameter has its own factory — `defineFields`, `defineFilters`, `definePagination`, `defineRelations`, `defineSorts` — returning a fragment that assigns directly into `defineQuery` input. Useful when query parts travel as data (props, composables, function arguments) before being assembled:

```typescript
import { defineFilters, defineQuery } from '@rapiq/core';

const scope = defineFilters<User>({ realm_id: id });

const query = defineQuery<User>({
    filters: scope,          // fragments assign without casts
    pagination: { limit: 10 },
});
```

Fragments and raw input mix freely; already-built AST nodes pass through unchanged.

## Next steps

- [Merging & Composition](/guide/merging-queries) — combining queries from multiple sources.
- [Queries over the Wire](/guide/wire) — encoding what you built.
- [Recipes: Type-safe frontend queries](/guide/recipes/frontend) — fragments and merging in a real list view.

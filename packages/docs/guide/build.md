# Building Queries

`defineQuery` builds a [Query AST](/guide/query) directly from typed input — no string round-trip, no parsing, no schema. It is the client-side entry point: construct the IR, hand it to the [URL codec](/integrations/url) for transport (or to an adapter directly).

```typescript
import { defineQuery } from '@rapiq/core';

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { name: { $contains: text }, realm_id: [id, null] },
    relations: ['realm'],
    sort: '-created_at',
    pagination: { limit: 10 },
});
```

Supplying a record generic (`defineQuery<User>`) types every field path (`'realm.name'`, …); without one, plain strings are accepted.

::: info No validation here
The build layer constructs the AST verbatim. What a client *may* request is decided server-side, where parsers validate against a [Schema](/guide/schema).
:::

## Filters value grammar

Four equivalent notations, none enforced:

| Notation | Example | Meaning |
|---|---|---|
| scalar | `{ name: 'John' }` | `eq` |
| bare array | `{ realm_id: [id, null] }` | `in` — `null` is a legal element; backend adapters rewrite it to `... OR IS NULL` |
| operator object | `{ age: { $gte: 18, $lt: 65 } }` | explicit operators, combined with **and** |
| condition helpers | `filters: or(gte('age', 18), eq('deleted_at', null))` | arbitrary condition trees |

Multiple keys combine with **and** (flat root-AND). Nested records (`{ realm: { name: 'master' } }`) and dot-paths (`{ 'realm.name': 'master' }`) are interchangeable. A bare `RegExp` value builds a `regex` condition.

### Operator objects

One key per [`FilterFieldOperator`](/guide/filters), prefixed with `$`:

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
        },                                     // to the element (helpers
    },                                         // work too: eq('name', …))
});
```

Operator keys that are present but `undefined` are skipped — conditional
spreads like `{ $contains: search || undefined }` simply contribute no
condition. Unknown `$` keys throw a `BuildError`
(`ErrorCode.OPERATOR_UNSUPPORTED`) — input is never guessed at.

::: warning Reserved: `$and` / `$or`
Compound object keys are reserved for the MongoDB-notation parser dialect ([Mongo Parser](/integrations/mongo)) and deliberately **not** part of the build layer. Compound trees are written with the condition helpers instead: `filters: or(...)`.
:::

## Condition helpers

Typed constructors for single conditions and compound trees — one per operator, named after the operator's enum value, mirroring the [expression dialect](/integrations/expression) one-to-one (`eq('name', 'John')` in code ≙ `eq(name, 'John')` on the wire):

```typescript
import { and, eq, gte, inArray, or } from '@rapiq/core';

const conditions = and(
    eq('name', 'John'),
    or(gte('age', 18), eq('deleted_at', null)),
);
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

::: warning Transporting compound trees
The simple [URL codec](/integrations/url) can only express **flat root-AND** filter sets on the wire. Encoding a query with `or(...)` or nested groups throws a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`) instead of silently flattening. Compound trees work with backend adapters directly and with the [expression dialect](/integrations/expression).
:::

## Other parameters

| Parameter | Input forms |
|---|---|
| `fields` | array of keys with optional `+`/`-` prefix (`['id', '+email', '-password']`), per-relation record (`{ realm: ['id'] }`), or tuple `[keys, record]` |
| `sort` | key with optional `-` prefix (`'-created_at'`), array of such keys, or record (`{ created_at: 'DESC', realm: { name: 'ASC' } }`) |
| `relations` | dot-path names (`['realm', 'items.user']`) or record (`{ realm: true, items: { user: true } }`) |
| `pagination` | `{ limit?, offset? }` |

## Fragment factories

Each parameter has its own factory — `defineFields`, `defineFilters`, `definePagination`, `defineRelations`, `defineSorts` — returning an AST fragment that assigns directly into `defineQuery` input. Useful when query parts are passed around as data (props, composables) before being assembled:

```typescript
import { defineFilters, defineQuery } from '@rapiq/core';

const scope = defineFilters<User>({ realm_id: id });

const query = defineQuery<User>({
    filters: scope,          // fragments assign without casts
    pagination: { limit: 10 },
});
```

Assembled fragments and raw input can be mixed freely; already-built AST nodes pass through unchanged. See [Merging Queries](/guide/merge) for composing whole queries.

## Coming from v1

- `buildQuery(input)` → `defineQuery(input)` returns the `Query` AST; serialize with the [URL codec](/integrations/url)'s `URLEncoder` (`encoder.encode(query)`).
- Magic value strings (`'>=18'`, `'~jo~'`, `'!null'`) → operator objects (`{ $gte: 18 }`, `{ $contains: 'jo' }`, `{ $ne: null }`) or condition helpers. The string prefixes remain part of the *wire* format only.

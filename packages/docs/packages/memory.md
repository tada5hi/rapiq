# @rapiq/memory

Evaluates a parsed [`Query`](/guide/query-ast) against **in-memory data** — plain JavaScript objects and arrays. It is the in-memory sibling of the [SQL](/packages/sql) and [TypeORM](/packages/typeorm) adapters: the same visitor-pattern surface, but instead of SQL fragments or a mutated query builder, the visitors compile the AST into plain functions.

```sh
npm install @rapiq/core @rapiq/memory
```

Typical uses: authorization guards that must agree with what the database query returns (see the [authorization recipe](/guide/recipes/authorization)), in-memory filtering of already-loaded collections, mock backends in tests, and applying a query to data that never lived in a database.

## Usage

Apply a whole query to a collection:

```typescript
import { applyQuery } from '@rapiq/memory';

const { data, total, pagination } = applyQuery(query, users);
```

- `data` — filtered → sorted → paginated → projected records.
- `total` — the number of matches *before* pagination (for the response `meta` block, mirroring the TypeORM adapter's pagination echo).
- `pagination` — the applied `{ limit, offset }`.

Or compile once and reuse:

```typescript
import { compileQuery } from '@rapiq/memory';

const compiled = compileQuery<User>(query);

compiled.matches(user);   // evaluate the filters against a single input -> boolean
compiled.apply(users);    // apply the whole query to a collection
```

## Applying a single parameter

Every parameter compiles independently into a plain function:

```typescript
import {
    compileFields,
    compileFilters,
    compilePagination,
    compileSorts,
} from '@rapiq/memory';
import { and, eq, gte } from '@rapiq/core';

const predicate = compileFilters(and(eq('name', 'Peter'), gte('age', 18)));
predicate({ name: 'Peter', age: 28 }); // true

const comparator = compileSorts(query.sorts);       // (a, b) => number
const projector = compileFields(query.fields);      // (input) => projected
const slicer = compilePagination(query.pagination); // (data) => page
```

Under the hood each `compile*` helper wraps a visitor class (`FiltersVisitor`, `SortsVisitor`, `FieldsVisitor`, `PaginationVisitor`, `QueryVisitor`) — subclass those for custom behavior. Compilation validates the AST (unknown operators throw); the compiled functions themselves never throw.

## Filter semantics

The package aims for **SQL parity**: the same query should select the same records in memory as `@rapiq/sql`/`@rapiq/typeorm` select from the database.

### Null & missing values

`undefined`, missing properties and `null` are one absent value (SQL has a single `NULL`).

- Positive operators (`eq`, `lt`, `lte`, `gt`, `gte`, `in`, `mod`, `contains`, `startsWith`, `endsWith`, `regex`) never match absent values — except `eq(field, null)`, `in` with a `null` element, and `exists(field, false)`.
- **Negated operators are exact complements**: `ne`, `nin`, `notContains`, `notStartsWith` and `notEndsWith` *do* match absent values. `ne('name', 'Peter')` matches a record without a name.
- `exists` means *has a non-null value* (SQL `IS NOT NULL`), not Mongo's "property present".
- Type mismatches evaluate to `false` — never to an error.

### String matching

`contains`, `startsWith`, `endsWith` (and their negations) are **case-insensitive** and treat the filter value as a literal — the same anchored regular expression the SQL adapter builds. Numbers are matched by their decimal string form; other value types never match.

### Join-row binding

Dotted paths emulate the SQL adapter's joins: all conditions on one relation path bind to the **same array element**, and the record matches if *some* assignment of elements satisfies the whole filter tree. An empty or absent array contributes one all-`null` row, like a LEFT JOIN.

```typescript
const user = {
    items: [
        { id: 1, active: false },
        { id: 2, active: true },
    ],
};

// no single item is both id=1 and active -> no match (sql join parity)
compileFilters(and(eq('items.id', 1), eq('items.active', true)))(user); // false

// same-element matching, stated explicitly — identical result in SQL and memory
compileFilters(elemMatch('items', and(eq('id', 1), eq('active', true))))(user); // false
```

`elemMatch` is field-prefix composition (exactly like the SQL adapter), so an `elemMatch` and a dotted condition on the same path share their binding. Where SQL has no opinion — a *leaf* value that is an array, e.g. `tags: ['a', 'b']` — Mongo element semantics apply: `eq('tags', 'a')` is membership, `in` is intersection.

### Divergences

| Case | @rapiq/memory | Baseline |
|---|---|---|
| Per-leaf array quantification | same-element binding | Mongo/ucast quantify each dotted condition independently |
| `exists` | is-not-null | Mongo: property presence |
| `contains` family | case-insensitive | Mongo/ucast: case-sensitive |

## Fields & relations projection

The data is already in memory, so `relations` never *adds* anything — and it never prunes either (without entity metadata, an embedded value object is indistinguishable from a relation). Projection follows the TypeORM adapter:

- No selected fields → **identity**: records pass through untouched (same references).
- Selected fields → only the picked properties survive; dotted picks (`items.title`) project into nested objects and arrays.
- `-`-flagged entries are dropped, never subtracted — subtract-from-default is resolved at parse time by the schema.
- An **included relation keeps its whole subtree** alongside a sparse field selection (`joinAndSelect` parity).

## Sorting & pagination

- Multi-key stable sort; absent values sort last ascending, first descending (pg semantics).
- Dotted sort paths traverse to-one objects; to-many paths resolve as absent.
- `limit`/`offset` apply only when strictly positive — `limit: 0` (and any negative) means *no limit*, mirroring the TypeORM adapter.

## Errors

Compilation throws a typed `AdapterError` for structural problems:

- an unknown filter operator or compound operator → `ErrorCode.OPERATOR_UNSUPPORTED`,
- a malformed `elemMatch` or `regex` value → `ErrorCode.FEATURE_UNSUPPORTED`.

Evaluation itself never throws — a guard is `if (!predicate(input)) { ... }`.

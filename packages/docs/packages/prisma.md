# @rapiq/prisma

Serializes a parsed [`Query`](/guide/query-ast) into a **Prisma argument object**: filters become `where`, fields become `select`, relations become `include`, sort becomes `orderBy` and pagination becomes `take`/`skip`.

```sh
npm install @rapiq/core @rapiq/prisma
```

Unlike the TypeORM adapter there is nothing to mutate: the adapter is a pure serializer that returns a plain object. `@prisma/client` is neither a runtime nor a peer dependency of this package. It is a devDependency only, because the test suite runs the emitted arguments through a real engine.

## Usage

```typescript
import { PrismaAdapter } from '@rapiq/prisma';

const adapter = new PrismaAdapter({ model: prisma.user });

const { args, pagination } = adapter.execute(query);

const users = await prisma.user.findMany(args);
```

A model delegate is all it takes: the model name, the datamodel (relations, cardinality, nullability, column types) and the active provider are read off the client the delegate belongs to. `pagination` echoes the limit/offset actually applied, e.g. for a response `meta` block.

Bind your generated argument type so the call site stays type-checked:

```typescript
const adapter = new PrismaAdapter<Prisma.UserFindManyArgs>({ /* … */ });
```

Because the adapter produces a value instead of writing into a builder, it is **stateless**: construct one instance per model and share it across requests. To combine several queries, compose them *before* serializing with [`mergeQueries`](/guide/merging-queries) or `query.filters.and(...)`; the adapter deliberately has no accumulation API.

## Running the query

A model-bound adapter can also run what it serialized, the counterpart of the typeorm adapter applying its state to the bound query builder:

```typescript
const { data, total, pagination } = await adapter.apply(query);
// or individually:
const rows = await adapter.findMany(query);
const total = await adapter.count(query);
```

`apply` returns rows, the pre-pagination total and the applied pagination in one call, shaped like [@rapiq/memory](/packages/memory)'s `applyQuery`; `count` sees the query's filters (and any baseline `where`) but never the page window. On an adapter constructed with explicit `{ provider, metadata }` the runners raise a typed error, since there is nothing to run against; `execute()` stays the pure serializer either way.

## Merging arguments

Prisma ships no per-call args composition (`$extends` intercepts every call globally), so the merge rules the adapter applies to its `base` option are exported as a standalone helper:

```typescript
import { mergeArgs } from '@rapiq/prisma';

const args = mergeArgs(baseline, produced);
```

`where` conditions are conjoined (`AND`), an overriding `include` joins a baseline `select` instead of replacing it (a caller-owned projection is never widened), `orderBy`/`take`/`skip` follow the override, and unknown keys (`cursor`, `distinct`, ...) pass through. The adapter's `execute(query, { base })` is exactly this merge applied to what the query produced.

## Model metadata

The adapter needs four facts about your model that a `Query` cannot carry, and each one changes what a *valid* Prisma filter looks like:

| fact | what it decides |
|---|---|
| is the path a relation? | Prisma rejects `not: null` on a relation: absence is a presence test |
| is that relation to-many? | `some`/`none` versus `is`; the wrong one is a validation error |
| can the column hold `null`? | a null comparison on a required column is a validation error |
| does it hold strings? | `mode: 'insensitive'` exists only on string filters |

Guessing any of them produces a runtime validation error rather than graceful degradation, so the adapter refuses to run without them. The client-bound form above derives all of it; the fully explicit form takes the same facts by hand:

```typescript
import { Prisma } from '@prisma/client';
import { PrismaAdapter, defineMetadata } from '@rapiq/prisma';

const adapter = new PrismaAdapter({
    provider: 'postgresql',
    metadata: defineMetadata(Prisma.dmmf.datamodel, 'User'),
});
```

Between the two sit `{ client: prisma, model: 'User' }` and per-option overrides (`provider`, `metadata`) on the client-bound shape.

::: warning
The client-bound form reads `_runtimeDataModel`, `_activeProvider` and the delegate's `$parent` backref: private but long-stable client internals (Prisma has no public reflection API, [prisma#19392](https://github.com/prisma/prisma/issues/19392)). The engine-backed test suite pins them against real generated clients, and every read fails typed rather than guessing. The explicit form is the private-API-free path.
:::

::: tip
`Prisma.dmmf` is unavailable in some builds (edge/wasm targets, the new `prisma-client` generator), and edge/wasm runtime datamodels are *pruned* (no cardinality or nullability); the adapter rejects those typed. `defineMetadata` accepts any object of the shape `{ models: [{ name, fields: [{ name, kind, isList, isRequired, type }] }] }`, so a hand-written datamodel works everywhere.
:::

## Parameter mapping

| Query parameter | Prisma argument |
|---|---|
| `filters`    | `where` |
| `fields`     | `select` |
| `relations`  | `include` (nested `select` when fields are picked) |
| `sort`       | `orderBy` (array of single-key objects, order preserved) |
| `pagination` | `take` / `skip` |

Prisma rejects `select` and `include` on the same level, so the adapter emits exactly one of them per level: a level that picks fields is projected sparsely with `select`, a level that only widens with relations uses `include`. An explicitly included relation is always hydrated whole: a sparse `relation.field` pick never narrows it, matching the projection contract of [@rapiq/memory](/packages/memory).

```typescript
// fields: ['id', 'realm.name']
{ select: { id: true, realm: { select: { name: true } } } }

// fields: ['id'], relations: ['realm']
{ select: { id: true, realm: true } }

// relations: ['items', 'items.realm']
{ include: { items: { include: { realm: true } } } }
```

## Schema derivation

The datamodel can also supply the *shape* of your schemas, the same staging as [@rapiq/typeorm](/packages/typeorm)'s entity derivation: the schema name, the relation allow-list and the `schemaMapping` used for relation traversal are derived, while authorization stays explicit. A derived schema without per-parameter options allows nothing.

```typescript
import { defineSchemaRegistryWithDatamodel } from '@rapiq/prisma';

const registry = defineSchemaRegistryWithDatamodel(Prisma.dmmf.datamodel, {
    schemas: {
        user: {
            fields: { allowed: 'inherit' },       // the model's field names
            filters: { allowed: ['id', 'name'] }, // authorization stays yours
        },
    },
});
```

One schema per model is registered under the lower-camel model name; hand-written schemas already in the registry take precedence. `defineSchemaWithModel(datamodel, 'User', options)` derives a single schema, and the `'inherit'` sentinel expands to the model's scalar and enum field names.

To catch schema/model drift (a renamed field, a stale allow-list entry) at boot time instead of as a dead entry:

```typescript
import { assertSchemaMatchesModel } from '@rapiq/prisma';

assertSchemaMatchesModel(schema, Prisma.dmmf.datamodel, 'User');
// throws SchemaModelMismatchError carrying EVERY offending key
```

## Preserving an application-owned predicate

Rapiq filters **narrow** a query, they never replace it. Hand the adapter a baseline argument object and the client's conditions are conjoined with your tenant or authorization scope:

```typescript
const { args } = adapter.execute(query, {
    base: { where: { realm_id: realmId } },
});

// where: { AND: [ { realm_id: … }, { …client filters } ] }
```

Baseline keys the query does not produce (`take`, `orderBy`, …) survive untouched: the same preservation contract [@rapiq/typeorm](/packages/typeorm) applies to a query builder.

## Negation

rapiq's negated operators (`ne`, `nin`, `notContains`, …) and `not(...)` groups are the **exact null-inclusive complement** of their positive twin: they match precisely the records the positive form does not. Prisma's `not` and `NOT` instead follow three-valued SQL logic and silently drop rows whose column is `NULL`.

The adapter therefore never delegates negation to Prisma. It pushes negation down to the leaves (De Morgan) and renders each complement itself:

```typescript
// ne('address', 'Mordor')
{ OR: [ { address: { not: 'Mordor' } }, { address: null } ] }

// ne('realm.name', 'master'): realm is an optional to-one relation
{ OR: [
    { realm: { is: { name: { not: 'master' } } } },
    { NOT: { realm: { is: {} } } },      // …or there is no realm at all
] }
```

The result set is identical to `@rapiq/sql`, `@rapiq/typeorm` and `@rapiq/memory`; the complement law is pinned by a cross-backend test suite. When metadata proves a column non-nullable the null arm is dropped, because no null can exist there.

A **to-many** path quantifies existentially, for the negated form too: the SQL backends evaluate the condition once per joined row, so a record with one matching and one non-matching element satisfies both a condition and its negation:

```typescript
// ne('items.title', 'book'): items is to-many
{ OR: [
    { items: { some: { title: { not: 'book' } } } },
    { items: { none: {} } },             // an empty collection is one null row
] }
```

**Same-element binding holds.** Two conditions on one to-many path (`filter[items.title]` and `filter[items.color]`) bind to the *same* joined row in the SQL backends, so the adapter factors them into a single `some` scope instead of emitting independent existentials:

```typescript
// and(eq('items.title', 'book'), eq('items.color', 'red'))
{ items: { some: { AND: [
    { title: { equals: 'book' } },
    { color: { equals: 'red' } },
] } } }
```

A record whose elements satisfy the two conditions only separately does not match, on any backend. Trees mixing root and relation conditions are expanded distributively first, so the guarantee also covers nested expression-dialect input. [`elemMatch`](/guide/filters#elemmatch) remains the explicit same-element construct.

## Case sensitivity

String comparison is [case-insensitive by default](/guide/filters#case-sensitivity) across all rapiq backends. Prisma expresses that with `mode: 'insensitive'`, which only some connectors accept, so the adapter takes a provider:

```typescript
new PrismaAdapter({ provider: 'mysql' });
```

| provider | behavior |
|---|---|
| `postgresql`, `cockroachdb`, `mongodb` | `mode: 'insensitive'` is emitted |
| `mysql`, `sqlserver` | nothing emitted: the default `*_ci` collation already compares case-insensitively |
| `sqlite` | nothing emitted: `contains`/`startsWith`/`endsWith` are ASCII-case-insensitive, `equals`/`in` are **not** |

`provider` is required, and an unrecognized name throws rather than falling back: emitting `mode` on a connector without support is a Prisma validation error on *every* case-insensitive filter, which is too sharp an edge to guess at.

Two narrowing rules apply on top. A non-string column never folds. And an **equality** whose value contains `%` or `_` compares case-sensitively instead, because Prisma lowers an insensitive `equals` to `ILIKE` with the operand passed through verbatim ([#20318](https://github.com/prisma/prisma/issues/20318), [#10810](https://github.com/prisma/prisma/issues/10810)): measured on Postgres 18:

```typescript
{ address: { equals: 'a_b', mode: 'insensitive' } }  // also matches 'axb', 'a%b'
{ address: { equals: 'a%b', mode: 'insensitive' } }  // matches everything
```

Matching too little is the safer failure, so those values keep the exact comparison. The rule is scoped to equality on purpose: `in`/`notIn` are never lowered to `ILIKE` and stay case-insensitive, while `contains`/`startsWith`/`endsWith` are `LIKE`-based with *or without* `mode`: that is Prisma's own behaviour, not something this adapter introduces.

Opt individual fields out through the schema:

```typescript
defineSchema<User>({
    filters: { allowed: ['id', 'token'], caseSensitive: ['token'] },
});
```

## Limitations

Operators without a Prisma equivalent raise a typed `AdapterError` (`FEATURE_UNSUPPORTED`) instead of being approximated:

- `regex`: no connector exposes a regular-expression filter
- `mod`: no modulo filter
- `size`: no array-length filter
- the `$this` element marker: the element itself is not addressable

Four further deviations are worth knowing:

- **Ordering by a to-many relation** is not expressible in Prisma (only `_count` is). Such a sort is emitted as written and rejected by Prisma.
- **Same-element binding.** Two conditions on the same to-many path (`filter[items.title]` and `filter[items.color]`) bind to the *same* joined row in the SQL backends, but Prisma evaluates each `some` independently, so they may match different elements. Use [`elemMatch`](/guide/filters#elemmatch) when the conditions must hold for one and the same element; it maps to a single `some` scope and agrees on every backend.
- **`elemMatch` targets a to-many relation.** Applying it to a to-one relation emits `some`, which Prisma rejects.
- **SQLite compares case-sensitively.** It has no `mode: 'insensitive'` and its `=` is case-sensitive, so the case-insensitive default does not hold there. `contains`/`startsWith`/`endsWith` are ASCII-case-insensitive via `LIKE`. Column-level `COLLATE NOCASE` is the fix. This is measured by the engine suite, not assumed.

## Verification

`npm run test:db` runs the whole parity matrix through a real Prisma client: against SQLite by default, and against PostgreSQL when `DB_TYPE=postgres` names a live server (CI runs both). Every condition is executed three ways: through the engine, through [@rapiq/memory](/packages/memory), and through an in-test evaluator, and all three must select the same records. The connector-specific claims on this page (the case contract, the wildcard behaviour) are measurements from that suite rather than assumptions.

A note on `exists()`: it asks whether a *value is present*, so on a to-many relation it is always true: a collection is possibly empty, never absent. That matches [@rapiq/memory](/packages/memory); "has no elements" is a different question that `exists` does not ask.

## Documentation

- [Filters](/guide/filters): operator reference and case semantics
- [Executing Queries](/guide/executing-queries): the adapter surface shared by all backends

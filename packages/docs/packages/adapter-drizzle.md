# @rapiq/adapter-drizzle

Serializes a parsed [`Query`](/guide/query-ast) into a **Drizzle relational query config**: filters become `where`, fields become `columns`, relations become `with`, sorts become `orderBy` and pagination becomes `limit`/`offset`.

```sh
npm install @rapiq/core @rapiq/adapter-drizzle
```

The adapter targets the object-based relational queries v2 API of **drizzle-orm v1**. Like the Prisma adapter there is nothing to mutate: it is a pure serializer that returns a plain object. `drizzle-orm` is neither a runtime nor a peer dependency of this package; it is a devDependency only, because the test suite runs the emitted configs through a real engine.

## Usage

```typescript
import { DrizzleAdapter, defineMetadata } from '@rapiq/adapter-drizzle';

const adapter = new DrizzleAdapter({
    provider: 'pg',
    metadata: defineMetadata(datamodel, 'users'),
});

const { config, pagination } = adapter.execute(query);

const users = await db.query.users.findMany(config);
```

`provider` names the dialect the config will execute against (see [Case sensitivity](#case-sensitivity)); `metadata` supplies the table facts the serializer needs (see [Table metadata](#table-metadata)). `pagination` echoes the limit/offset actually applied, e.g. for a response `meta` block.

Because the adapter produces a value instead of writing into a builder, it is **stateless**: construct one instance per table and share it across requests. To combine several queries, compose them *before* serializing with [`mergeQueries`](/guide/merging-queries) or `query.filters.and(...)`; the adapter deliberately has no accumulation API. `buildDrizzleConfig(query, options)` is the one-shot convenience form.

## Table metadata

The adapter needs four facts about your tables that a `Query` cannot carry, and each one changes what a *correct* drizzle filter looks like:

| fact | what it decides |
|---|---|
| is the path a relation? | a relation takes a nested filter object or a presence test, never a column operator |
| is that relation to-many? | the shape of the empty-collection arm of a complement |
| can the column hold `null`? | whether a complement carries its `isNull` arm |
| does it hold strings? | only string columns fold case through `ilike` |

Guessing any of them produces a wrong result set rather than graceful degradation, so the adapter refuses to run without them. The datamodel is a plain object in drizzle's own vocabulary (`dataType` as on a drizzle column, relations keyed the way `defineRelations` keys them); a bare string is shorthand for `{ dataType }`:

```typescript
const metadata = defineMetadata({
    users: {
        columns: {
            id: { dataType: 'number', nullable: false },
            name: 'string',
            address: { dataType: 'string', nullable: true },
        },
        relations: {
            items: { target: 'items', many: true },
            realm: { target: 'realms', many: false },
        },
    },
    items: { /* ... */ },
    realms: { /* ... */ },
}, 'users');
```

An undeclared fact is treated as unknown, never guessed: an unknown nullability keeps the complement's null arm (semantically safe either way), an unknown data type keeps the case fold.

## Parameter mapping

| Query parameter | findMany config key |
|---|---|
| `filters`    | `where` |
| `fields`     | `columns` |
| `relations`  | `with` (nested `columns` when fields are picked) |
| `sorts`      | `orderBy` (one object, key order carries the priority) |
| `pagination` | `limit` / `offset` |

Unlike Prisma's `select`/`include`, drizzle keeps scalar selection (`columns`) and relation hydration (`with`) in separate keys that compose at every level. An explicitly included relation without direct picks is hydrated whole; a per-relation fieldset (direct `relation.field` picks) narrows it to exactly those columns, matching the projection contract of [@rapiq/adapter-memory](/packages/adapter-memory) ([#847](https://github.com/tada5hi/rapiq/issues/847)). Picks belonging to a deeper relation never narrow the traversed prefix, and a level reached only to project deeper emits `columns: {}` (no scalars of its own).

Every column a [field visibility gate](/guide/schemas#condition-verdicts) reads is force-projected into `columns` (the gates themselves are enforced post-fetch via `@rapiq/adapter-memory`'s `applyFieldConditions`, exactly as with the SQL backends). Those operand entries never narrow an include: behind a pick-free whole relation the hydration covers them anyway.

```typescript
// fields: ['id', 'realm.name']
{ columns: { id: true }, with: { realm: { columns: { name: true } } } }

// fields: ['id'], relations: ['realm']
{ columns: { id: true }, with: { realm: true } }

// relations: ['items', 'items.realm']
{ with: { items: { with: { realm: true } } } }
```

An unsatisfiable condition (e.g. `in([])`) has no dialect-free false literal in the filter object (drizzle strips an empty `OR` group instead of failing the row set), so it is expressed through the config: `limit: 0` returns no rows on every dialect, and a caller-owned baseline cannot widen it.

## Preserving an application-owned predicate

Rapiq filters **narrow** a query, they never replace it. Hand the adapter a baseline config and the client's conditions are conjoined with your tenant or authorization scope:

```typescript
const { config } = adapter.execute(query, {
    base: { where: { realm_id: realmId } },
});

// where: { AND: [ { realm_id: ... }, { ...client filters } ] }
```

An overriding `columns` replaces the baseline projection (a caller-owned projection is never widened), produced `with` entries join baseline ones, and `orderBy`/`limit`/`offset` follow the override. The merge rules are exported as `mergeConfig(base, override)` for use outside the adapter.

## Negation

rapiq's negated operators (`ne`, `nin`, `notContains`, ...) and `not(...)` groups are the **exact null-inclusive complement** of their positive twin: they match precisely the records the positive form does not. Drizzle renders `NOT` as plain SQL `NOT (...)`, which follows three-valued logic and silently drops rows whose column is `NULL`.

The adapter therefore never applies drizzle's `NOT` to a user condition. It pushes negation down to the leaves (De Morgan, via `@rapiq/core`'s `distributeNegation`) and renders each complement itself; `isNull`/`isNotNull` make every arm expressible in the filter object:

```typescript
// ne('address', 'Mordor')
{ OR: [ { address: { notIlike: 'Mordor' } }, { address: { isNull: true } } ] }

// ne('realm.name', 'master'): realm is an optional to-one relation
{ OR: [
    { realm: { name: { notIlike: 'master' } } },
    { NOT: { realm: true } },      // ...or there is no realm at all
] }
```

The one emitted `NOT` negates a relation **presence test** (`{ realm: true }`), which compiles to `EXISTS` and is two-valued by construction. When metadata proves a column non-nullable the null arm is dropped, because no null can exist there. The result set is identical to `@rapiq/adapter-sql`, `@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma` and `@rapiq/adapter-memory`; the complement law is pinned by the engine-backed parity suite.

**Same-element binding holds.** A relation filter object is a single correlated `EXISTS` scope in drizzle, so conditions sharing a to-many path are factored into ONE object and bind to the same related record, exactly like the per-join-row evaluation of the SQL backends:

```typescript
// and(eq('items.title', 'book'), eq('items.color', 'red'))
{ items: { AND: [
    { title: { ilike: 'book' } },
    { color: { ilike: 'red' } },
] } }
```

A record whose elements satisfy the two conditions only separately does not match, on any backend. Trees mixing root and relation conditions are expanded distributively first (bounded; a tree beyond the bound fails typed instead of degrading), and every quantifier gains a `NOT: { relation: true }` empty-collection arm exactly when its interior holds at the all-null binding an empty collection contributes. [`elemMatch`](/guide/filters#elemmatch) remains the explicit same-element construct and maps onto the same single scope.

## Case sensitivity

String comparison is [case-insensitive by default](/guide/filters#case-sensitivity) across the rapiq backends. Drizzle has no `mode: 'insensitive'`; the fold is expressed through operators, so the adapter takes a provider, and dialect capability decides how far the contract reaches (on sqlite the equality family cannot fold, see the table):

```typescript
new DrizzleAdapter({ provider: 'mysql', metadata });
```

| provider | behavior |
|---|---|
| `pg` | anchored operators use `ilike`; an insensitive equality/membership lowers to `ilike` with a fully escaped operand |
| `mysql` | plain operators: the default `*_ci` collation already compares case-insensitively |
| `sqlite` | `like` is ASCII-case-insensitive, `eq`/`in` are **not**: a documented limitation |

`provider` is required, and an unrecognized name throws rather than falling back: emitting `ilike` on a dialect without it breaks every case-insensitive filter, which is too sharp an edge to guess at.

Because the adapter builds the LIKE operand itself, a lowered equality escapes `%`, `_` and `\` first: `eq('code', '50%')` matches exactly the literal string, never a wildcard pattern. (The Prisma adapter needs a wildcard veto here because Prisma passes the operand through verbatim; this adapter does not.) An insensitive membership decomposes into `ilike` arms per string member, keeping non-string members an exact `in`.

Two boundaries remain. A non-string column never folds. And on dialects without a default LIKE escape character (sqlite), an anchored operator whose text contains a literal `%` or `_` cannot be matched exactly: the adapter fails typed instead of silently widening the match.

Opt individual fields out through the schema:

```typescript
defineSchema<User>({
    filters: { allowed: ['id', 'token'], caseSensitive: ['token'] },
});
```

The declaration is not consumed automatically: the receiving side forwards it to the adapter, mirroring the [shared contract](/guide/filters#case-sensitivity). The adapter takes `caseSensitive` as a top-level constructor option (a field list, or `true` to opt every field out), and `execute` accepts it as a per-call override:

```typescript
const adapter = new DrizzleAdapter({
    provider: 'pg',
    metadata,
    caseSensitive: schema.filters.caseSensitive,
});

// per call, overriding the constructor value:
adapter.execute(query, { caseSensitive: true });
```

## Limitations

Operators without a drizzle filter equivalent raise a typed `AdapterError` (`FEATURE_UNSUPPORTED`) instead of being approximated:

- `regex`: the filter object exposes no regular-expression operator
- `mod`: no modulo filter
- `size`: no array-length filter
- `elemMatch` on a scalar array and the `$this` element marker: only to-many *relations* have addressable elements
- **ordering by a relation path**: the relational API orders the root by its own columns only; an undocumented nested shape could be silently ignored, and loud beats silent

`exists()` on a to-many relation is constantly true: it asks whether a *value is present*, and a collection is possibly empty, never absent. That matches [@rapiq/adapter-memory](/packages/adapter-memory).

## Verification

The default test suite already executes every emitted config through a real drizzle engine: in-memory SQLite via `better-sqlite3`, no codegen, no server. `npm run test:db` replays the same parity matrix against PostgreSQL when `DB_TYPE=postgres` names a live server (CI runs it), which is the only place `ilike` exists and the case contract can be measured. Every condition is cross-checked against [@rapiq/adapter-memory](/packages/adapter-memory); the dialect-specific claims on this page are measurements from that suite rather than assumptions.

## Documentation

- [Filters](/guide/filters): operator reference and case semantics
- [Executing Queries](/guide/executing-queries): the adapter surface shared by all backends

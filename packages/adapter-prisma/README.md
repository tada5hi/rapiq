<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/adapter-prisma</h1>

<p align="center">
  <b>Turn a rapiq <code>Query</code> into a Prisma argument object.</b><br>
  A pure serializer: nothing is mutated, no database is touched,<br>
  and <code>@prisma/client</code> is not a dependency.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/adapter-prisma"><img src="https://img.shields.io/npm/v/@rapiq/adapter-prisma?color=%23a21caf&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/adapter-prisma"><img src="https://img.shields.io/npm/types/@rapiq/adapter-prisma?color=%23db2777" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/adapter-prisma?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/adapter-prisma"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/adapter-prisma">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq). Typed REST queries: *build, transport, validate, execute.*
Where the TypeORM adapter writes into a query builder, this one returns a plain `findMany` argument object you hand straight to Prisma.

- 🧾 **Just a value**: `execute(query)` returns `{ args, pagination }`. Nothing is mutated, so the adapter is trivial to test, log, cache or post-process.
- 🔗 **Zero coupling**: `@prisma/client` is neither a runtime nor a peer dependency. Bind your generated `Prisma.<Model>FindManyArgs` type and the call site stays fully checked.
- 🧮 **Exact semantics**: negation is the null-inclusive complement and conditions on one to-many path bind to the same element, exactly as in `@rapiq/adapter-sql`, `@rapiq/adapter-typeorm` and `@rapiq/adapter-memory`. Prisma's three-valued `not` and independent `some` scopes are never relied upon.
- 🔬 **Measured, not modelled**: the parity suite runs every condition through a real Prisma engine (SQLite by default, PostgreSQL in CI) and cross-checks it against `@rapiq/adapter-memory`.

```typescript
import { PrismaAdapter, defineMetadata } from '@rapiq/adapter-prisma';

const adapter = new PrismaAdapter({
    model: prisma.user,
    // the model facts; hand-written on prisma 7 (see Model binding)
    metadata: defineMetadata(datamodel, 'User'),
});

const { args, pagination } = adapter.execute(query);

const users = await prisma.user.findMany(args);
```

## Installation

```sh
npm install @rapiq/core @rapiq/adapter-prisma
```

## What a query becomes

| Query parameter | Prisma argument |
|---|---|
| `filters` | `where` |
| `fields` | `select` |
| `relations` | `include`, or a nested `select` when fields are picked |
| `sort` | `orderBy` (an array of single-key objects, order preserved) |
| `pagination` | `take` / `skip` |

`pagination` is echoed back from `execute()` as the limit/offset actually applied, ready for a response `meta` block.

## Running the query

A model-bound adapter can run what it serialized: `findMany` pipes the arguments into the delegate, `count` reports the pre-pagination total, and both accept the same `base` option. `execute()` stays the pure serializer.

```typescript
const rows = await adapter.findMany(query, {
    base: { where: { realm_id: realmId } },
});
```

The merge rules behind `base` are exported as `mergeArgs(base, override)` for use outside the adapter; prisma itself ships no per-call args composition.

## Model binding

A model delegate binds the model name, the active provider and the runners, read off its client (private but long-stable internals, pinned against real generated clients by the engine suite; every read fails typed rather than guessing). On Prisma 6 classic builds the datamodel is derived the same way; Prisma 7 prunes the runtime datamodel, so pass `metadata` alongside the delegate. When a client exposes the public `$datamodel`/`$provider` reflection surface (prisma#29792), the adapter prefers it over the private reads. The private-API-free alternative supplies the same facts explicitly:

```typescript
import { PrismaAdapter, defineMetadata } from '@rapiq/adapter-prisma';

// hand-written, so it works on every Prisma version
export const datamodel = {
    models: [
        {
            name: 'User',
            fields: [
                { name: 'id', kind: 'scalar', type: 'Int', isList: false, isRequired: true },
                { name: 'name', kind: 'scalar', type: 'String', isList: false, isRequired: true },
                { name: 'email', kind: 'scalar', type: 'String', isList: false, isRequired: true },
                { name: 'realm', kind: 'object', type: 'Realm', isList: false, isRequired: false },
            ],
        },
        {
            name: 'Realm',
            fields: [
                { name: 'id', kind: 'scalar', type: 'Int', isList: false, isRequired: true },
                { name: 'name', kind: 'scalar', type: 'String', isList: false, isRequired: true },
            ],
        },
    ],
};

const adapter = new PrismaAdapter({
    provider: 'postgresql',
    metadata: defineMetadata(datamodel, 'User'),
});
```

On Prisma 6 classic builds `defineMetadata(Prisma.dmmf.datamodel, 'User')` derives the same facts. It does not work on Prisma 7, which prunes the runtime datamodel.

The adapter needs four facts about your model that a `Query` cannot carry, and each one changes what a *valid* Prisma filter looks like:

| fact | what it decides |
|---|---|
| is the path a relation? | Prisma rejects `not: null` on a relation, so absence is a presence test |
| is that relation to-many? | `some` / `none` versus `is`; the wrong one is a validation error |
| can the column hold `null`? | a null comparison on a required column is a validation error |
| does it hold strings? | `mode: 'insensitive'` exists only on string filters |

Guessing any of them produces a runtime validation error rather than graceful degradation. `defineMetadata` accepts a client, a runtime datamodel or any object shaped like a Prisma datamodel, so a hand-written one works everywhere. Prisma 7 prunes every runtime datamodel to names and kinds (`Prisma.dmmf` included, as the v6 edge/wasm builds already did); pruned input is rejected typed rather than guessed.

## Schema derivation

The datamodel can also supply the *shape* of your schemas: derived name, relation allow-list and `schemaMapping`, with authorization staying explicit (`allowed: 'inherit'` opts a parameter into the model's field names). Hand-written schemas take precedence, and `assertSchemaMatchesModel` turns schema/model drift into a boot-time failure carrying every offending key.

```typescript
import { defineSchemaRegistryWithDatamodel } from '@rapiq/adapter-prisma';

const registry = defineSchemaRegistryWithDatamodel(datamodel, {
    schemas: {
        user: { filters: { allowed: ['id', 'name'] } },
    },
});
```

## Preserving an application-owned predicate

Rapiq filters **narrow** a query, they never replace it. Pass a baseline argument object and the caller's conditions are conjoined with your tenant or authorization scope:

```typescript
const { args } = adapter.execute(query, {
    base: { where: { realm_id: realmId } },
});

// where: { AND: [ { realm_id: ... }, { ...client filters } ] }
```

A baseline `select` is never widened either: relations the query hydrates join it instead of replacing it.

## Case sensitivity

String comparison is case-insensitive by default across all rapiq backends. Prisma expresses that with `mode: 'insensitive'`, which only some connectors accept, so the provider decides:

| provider | behaviour |
|---|---|
| `postgresql`, `cockroachdb`, `mongodb` | `mode: 'insensitive'` is emitted |
| `mysql`, `sqlserver` | nothing emitted; the default `*_ci` collation already compares case-insensitively |
| `sqlite` | nothing emitted; `contains` / `startsWith` / `endsWith` are ASCII-case-insensitive, `equals` is not |

## Limitations

Operators without a Prisma equivalent raise a typed `AdapterError` instead of being approximated: `regex`, `mod`, `size` and the `$this` element marker. Ordering by a to-many relation is not expressible in Prisma either.

Conditions on one to-many path are factored into a single `some` scope, so they bind to the same element on every backend; `elemMatch` remains the explicit same-element construct. `elemMatch` on a to-one relation raises a typed error.

## The rapiq family

| Package | Purpose |
|---|---|
| [@rapiq/core](https://github.com/tada5hi/rapiq/tree/master/packages/core) | Query AST, typed build layer & schema system (the shared foundation) |
| [@rapiq/parser-simple](https://github.com/tada5hi/rapiq/tree/master/packages/parser-simple) | Parse plain object/array input (the "simple" dialect) |
| [@rapiq/parser-expression](https://github.com/tada5hi/rapiq/tree/master/packages/parser-expression) | Parse filter expressions like `and(eq(name,'John'), gte(age,'18'))` |
| [@rapiq/parser-mongo](https://github.com/tada5hi/rapiq/tree/master/packages/parser-mongo) | Parse MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url](https://github.com/tada5hi/rapiq/tree/master/packages/codec-url) | URL query-string transport codec |
| [@rapiq/adapter-sql](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| **[@rapiq/adapter-prisma](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-prisma)** | Serialize a query into a Prisma argument object |
| [@rapiq/adapter-drizzle](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-drizzle) | Serialize a query into a Drizzle relational query config |
| [@rapiq/adapter-memory](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/packages/adapter-prisma).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

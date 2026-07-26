<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/prisma</h1>

<p align="center">
  <b>Turn a rapiq <code>Query</code> into a Prisma argument object.</b><br>
  A pure serializer: nothing is mutated, no database is touched,<br>
  and <code>@prisma/client</code> is not a dependency.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rapiq/prisma"><img src="https://img.shields.io/npm/v/@rapiq/prisma/beta?color=%237c3aed&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@rapiq/prisma"><img src="https://img.shields.io/npm/types/@rapiq/prisma?color=%2306b6d4" alt="types"></a>
  <a href="https://github.com/tada5hi/rapiq/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@rapiq/prisma?color=blue" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://rapiq.tada5hi.net/packages/prisma"><b>Documentation</b></a>
  ·
  <a href="https://github.com/tada5hi/rapiq">Monorepo</a>
  ·
  <a href="https://www.npmjs.com/package/@rapiq/prisma">npm</a>
</p>

---

Part of [**rapiq**](https://github.com/tada5hi/rapiq). Typed REST queries: *build, transport, validate, execute.*
Where the TypeORM adapter writes into a query builder, this one returns a plain `findMany` argument object you hand straight to Prisma.

- 🧾 **Just a value**: `execute(query)` returns `{ args, pagination }`. Nothing is mutated, so the adapter is trivial to test, log, cache or post-process.
- 🔗 **Zero coupling**: `@prisma/client` is neither a runtime nor a peer dependency. Bind your generated `Prisma.<Model>FindManyArgs` type and the call site stays fully checked.
- 🧮 **Exact semantics**: negation is the null-inclusive complement and conditions on one to-many path bind to the same element, exactly as in `@rapiq/sql`, `@rapiq/typeorm` and `@rapiq/memory`. Prisma's three-valued `not` and independent `some` scopes are never relied upon.
- 🔬 **Measured, not modelled**: the parity suite runs every condition through a real Prisma engine (SQLite by default, PostgreSQL in CI) and cross-checks it against `@rapiq/memory`.

```typescript
import { PrismaAdapter } from '@rapiq/prisma';

const adapter = new PrismaAdapter({ model: prisma.user });

const { args, pagination } = adapter.execute(query);

const users = await prisma.user.findMany(args);
```

## Installation

```sh
npm install @rapiq/core @rapiq/prisma
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

A model delegate binds everything: the model name, the datamodel and the active provider are read off its client (private but long-stable internals, pinned against real generated clients by the engine suite; every read fails typed rather than guessing). The private-API-free alternative supplies the same facts explicitly:

```typescript
import { Prisma } from '@prisma/client';
import { PrismaAdapter, defineMetadata } from '@rapiq/prisma';

const adapter = new PrismaAdapter({
    provider: 'postgresql',
    metadata: defineMetadata(Prisma.dmmf.datamodel, 'User'),
});
```

The adapter needs four facts about your model that a `Query` cannot carry, and each one changes what a *valid* Prisma filter looks like:

| fact | what it decides |
|---|---|
| is the path a relation? | Prisma rejects `not: null` on a relation, so absence is a presence test |
| is that relation to-many? | `some` / `none` versus `is`; the wrong one is a validation error |
| can the column hold `null`? | a null comparison on a required column is a validation error |
| does it hold strings? | `mode: 'insensitive'` exists only on string filters |

Guessing any of them produces a runtime validation error rather than graceful degradation. `defineMetadata` accepts a client, a runtime datamodel or any object shaped like a Prisma datamodel, so a hand-written one works where `Prisma.dmmf` is unavailable (edge and wasm builds, the new `prisma-client` generator; pruned edge/wasm runtime datamodels are rejected typed).

## Schema derivation

The datamodel can also supply the *shape* of your schemas: derived name, relation allow-list and `schemaMapping`, with authorization staying explicit (`allowed: 'inherit'` opts a parameter into the model's field names). Hand-written schemas take precedence, and `assertSchemaMatchesModel` turns schema/model drift into a boot-time failure carrying every offending key.

```typescript
import { defineSchemaRegistryWithDatamodel } from '@rapiq/prisma';

const registry = defineSchemaRegistryWithDatamodel(Prisma.dmmf.datamodel, {
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
| [@rapiq/sql](https://github.com/tada5hi/rapiq/tree/master/packages/sql) | Dialect-agnostic SQL fragment adapter (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/typeorm) | Apply a query to a TypeORM `SelectQueryBuilder` |
| **[@rapiq/prisma](https://github.com/tada5hi/rapiq/tree/master/packages/prisma)** | Serialize a query into a Prisma argument object |
| [@rapiq/memory](https://github.com/tada5hi/rapiq/tree/master/packages/memory) | Evaluate a query against in-memory objects & arrays |

## Documentation

To find out more, head over to the [documentation](https://rapiq.tada5hi.net/packages/prisma).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

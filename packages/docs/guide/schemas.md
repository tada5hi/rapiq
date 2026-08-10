# Schemas & Validation

A `Schema<RECORD>` is the receiving side's contract: it declares, per parameter, what a client **may** request. Parsers consult it *while* parsing. Most parameters drop input outside the allow-lists by default and throw when `throwOnFailure` is set; expression filters always reject schema-key violations. Without a schema, a parser accepts any syntactically valid input; with one, the query that reaches your database is guaranteed to stay inside the contract.

## Defining a schema

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: Item[],
};

const userSchema = defineSchema<User>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email', 'age'],
        default: ['id', 'name'],
    },
    filters: {
        allowed: ['id', 'name', 'age'],
    },
    relations: {
        allowed: ['realm', 'items'],
    },
    sort: {
        allowed: ['id', 'name', 'age'],
        default: { id: 'DESC' },
    },
    pagination: {
        maxLimit: 50,
    },
    schemaMapping: {
        realm: 'realm',
        items: 'item',
    },
});
```

Field keys are typed against `RECORD` via recursive key paths: `allowed` and `default` autocomplete and type-check. `null`/`undefined` are unwrapped before traversal, so nullable or optional relations (`realm: Realm | null`) type-check like their non-nullable counterparts. Index-signature records (JSON columns such as `data: Record<string, any>`) count as selectable/filterable leaf keys and are not traversed as nested branches.

## Top-level options

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Registry key; also used to resolve nested schemas. |
| `throwOnFailure` | `boolean` | Throw on disallowed input instead of dropping it. Inherited by every sub-schema that doesn't set its own value. |
| `strict` | `boolean` | A parameter without an explicit allow-list rejects all client input instead of permitting any syntactically valid key. Inherited like `throwOnFailure`. See [Strict mode](#strict-mode). |
| `schemaMapping` | `Record<string, string>` | Maps a relation name to a registered schema name, so nested input (`realm.name`) validates against the related record's schema. |
| `indexes` | `string[][]` | Ordered column lists of the record's storage indexes, own-table keys only. Inert on its own; the `filters` and `sort` sub-schemas opt into enforcement via `indexed`. See [Indexes](#indexes). |

## Per-parameter options

Every sub-schema also accepts its own `throwOnFailure` and `strict`.

| Parameter | Options |
|---|---|
| `fields` | `allowed`, `default`, `mapping` (alias to field), `validate` / `validateMany` ([per-key hooks](#validate-hooks-parse-context)) |
| `filters` | `allowed`, `default` (a default condition), `mapping`, `validate` (per-filter validation hook), `caseSensitive` ([exact-equality opt-out](/guide/filters#case-sensitivity)), `indexed` ([index enforcement](#indexes)) |
| `relations` | `allowed`, `mapping`, `validate` / `validateMany` ([per-key hooks](#validate-hooks-parse-context)) |
| `sort` | `allowed`, `default`, `mapping`, `validate` / `validateMany` ([per-key hooks](#validate-hooks-parse-context)), `indexed` ([index enforcement](#indexes)) |
| `pagination` | `maxLimit` |

Standalone factories exist for each parameter (`defineFieldsSchema`, `defineFiltersSchema`, `defineRelationsSchema`, `defineSortSchema`, `definePaginationSchema`), useful when calling a single parameter parser directly.

::: tip Empty vs. absent
`allowed: []` blocks the parameter entirely; **omitting** `allowed` permits everything, unless [strict mode](#strict-mode) is on. Be deliberate about which one you mean.
:::

## Defaults

Defaults fill the gaps when a client sends nothing (or nothing valid) for a parameter:

- `fields.default`: the selection when no fields are requested; `+`/`-` modifiers in client input extend/shrink it instead of replacing it.
- `filters.default`: a condition applied when the client sends no filters.
- `sort.default`: the order applied when nothing valid was requested.
- `pagination.maxLimit`: doubles as the applied limit when the client requests none.

A parameter absent from the input is still parsed, so defaults always apply, even when the client sends nothing at all.

## Strict mode

By default, a parameter whose schema declares no allow-list is **open**: any syntactically valid key passes. `strict: true` inverts that: a parameter accepts client input only for explicitly declared keys:

```typescript
const userSchema = defineSchema<User>({
    name: 'user',
    strict: true,
    filters: { allowed: ['id', 'name'] },
    // fields/relations/sort declare nothing -> client input for them is rejected
});
```

Per parameter, "declared" means:

| Parameter | Client input accepted when |
|---|---|
| `fields` | `allowed` or `default` is set (validated against both lists) |
| `filters` | `allowed` is set (a `default` condition alone still applies, but clients cannot filter) |
| `sort` | `allowed` or `default` is set (the allow-list derives from the default's keys) |
| `relations` | `allowed` is set |
| `pagination` | always; `maxLimit` remains the only constraint |

Schema defaults are unaffected: dropped client input falls back to `default` values exactly as if the parameter had been absent.

`strict` can also be set per parse call, overriding the schema setting, including parsing **without** a schema, which then rejects every client-driven parameter:

```typescript
parser.parse(input, { schema: 'user', strict: true });
```

::: warning Migrating from typeorm-extension?
typeorm-extension **disables** any parameter whose `allowed`/`default` options are missing. rapiq's default is the opposite (open). Enable `strict: true` to keep closed-by-default semantics; see the [migration guide](/guide/migration-typeorm-extension).
:::

## Indexes {#indexes}

A schema can declare which storage indexes exist for its record and require client queries to use them, so a client cannot force a full table scan by filtering or sorting on unindexed columns:

```typescript
const userSchema = defineSchema<User>({
    name: 'user',
    indexes: [
        ['realm_id', 'created_at'],
        ['email'],
    ],
    filters: { indexed: true },     // true | 'anchor' | 'cover'
    sort: { indexed: true },
});
```

`indexes` lists each index as its ordered column sequence: own-table keys only (a composite index never spans tables), resolved names (after `mapping`). The declaration alone is inert; each parameter opts in via `indexed`, and it also appears in [`describe()`](#describing-a-schema).

**Filters.** With `indexed: true` (alias `'anchor'`), every AND group of the final parsed tree must contain at least one conjunct whose field is the leading column of a declared index: that index narrows the row set, everything else is residual filtering. An `or(...)` passes only when every branch passes on its own, since a database can only avoid a scan on an OR when each branch is indexed; a nested compound conjunct counts as an anchor when it passes the check itself. With `indexed: 'cover'`, additionally every filtered field must be index-served: per relation path, the AND group's field set must equal a leftmost prefix (as a set, since AND order is meaningless) of one declared index.

**Sort.** With `sort: { indexed: true }`, the requested keys must equal, in order, a leftmost prefix of one declared index. Directions are ignored, and all keys must share one relation path: no single index anywhere serves cross-table ordering.

**The check is structural.** Operators, negation and case folding are deliberately ignored: which operators an index can serve differs per engine (a Postgres trigram index serves `contains`, a hash index only equality, an expression index changes the picture entirely), so rapiq trusts the declaration and enforces combinations only. Declare only what your storage actually serves.

**Relations.** A dotted key such as `items.title` checks the declaration of the schema governing `items` (resolved through the registry and `schemaMapping`), so each schema declares its own indexes. A governing schema without a declaration contributes no anchors and fails cover mode.

**Server-authored conditions.** The filters `default` and sort defaults bypass the check, and the check runs on the final tree after [`validate` hooks](#validate-hooks-parse-context): a policy residual that conjoins an indexed condition (e.g. `eq('realm_id', actorRealm)`) legitimately anchors the executed query.

**Failure** follows the standard [drop vs. throw](#failure-behavior-drop-vs-throw) policy: a violating parameter is dropped whole (filters fall back to the `default`, sort to its defaults), or throws a typed error with code `keyCombinationNotIndexed` under `throwOnFailure`. Two guardrails harden the filters drop path: a violating tree that carries a [preserved](/guide/filters#schema-options) condition refuses to drop it and throws `SCHEMA_PRESERVED_CONDITION_PRUNED` (mirroring relation pruning), and a violation on a schema without a filters `default` always throws, since dropping to an empty filter set would execute exactly the unfiltered scan the policy exists to prevent.

::: warning Footgun
`indexed` without any reachable `indexes` declaration (own or on related schemas) can never be satisfied: every non-empty request drops to the `default`, or throws when there is none. Declaring `indexes: []` means exactly that: nothing is indexed.
:::

## Validate hooks and parse context {#validate-hooks-parse-context}

Allow-lists are static, decided when the schema is defined. The `validate` hooks decide **per request**: every parse/decode call may carry an opaque `context` (typically the authenticated actor), and the `relations`, `fields` and `sort` sub-schemas may declare a hook that answers for each client-requested key with that context in hand:

```typescript
type Actor = { can: (permission: string) => Promise<boolean> };

const userSchema = defineSchema<User, Actor>({
    name: 'user',
    relations: {
        allowed: ['realm', 'items'],
        // may THIS actor include THIS relation?
        validate: (relation, actor) => actor.can(`${relation}_read`),
    },
    schemaMapping: { items: 'item' },
});

const query = await parser.parseAsync(input, { schema: 'user', context: actor });
// or, at the transport boundary:
const query = await codec.decodeAsync(req.query, { schema: 'user', context: actor });
```

### The verdict

A hook is invoked once per resolved (alias-mapped, allow-listed) key and answers with one of:

| Return value | Meaning |
|---|---|
| `true` (any truthy value that isn't a condition) | Accept the key. |
| `false` / `undefined` (any falsy value) | Reject it: dropped by default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) under [`throwOnFailure`](#failure-behavior-drop-vs-throw). |
| an `ICondition` | Accept the key, but mark its column **visible only on rows satisfying that condition**. `fields` only; see [Condition verdicts](#condition-verdicts). |
| a `Promise` of any of the above | Same meaning, but the call must go through `parseAsync()` / `decodeAsync()`. |

An inspect-only hook must therefore end with `return true`: a hook that falls off the end returns `undefined` and rejects every key.

### Where the key sits: the scope argument

Every hook receives a third argument describing *where* the key sits, so it can branch on position and not only on name:

```typescript
type KeyValidationScope = {
    parameter: 'fields' | 'filters' | 'pagination' | 'relations' | 'sort',
    path: string,       // dotted relation path of the governing schema; '' at the query root
    schema?: string,    // registered name of that schema; undefined for an inline schema
};
```

`parameter` lets one hook factory serve `fields` and `sort`. `path` distinguishes the positions a single schema occupies in one query: the root, `'items'`, `'items.realm'`. Here the `user` schema is reachable twice, and `email` is readable only on the collection itself, not when the same record hangs off an item:

```typescript
const userSchema = defineSchema<User, Actor>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email'],
        validate: (field, actor, scope) => field !== 'email' || scope.path === '',
    },
    relations: { allowed: ['items'] },
    schemaMapping: { items: 'item' },
});

const itemSchema = defineSchema<Item, Actor>({
    name: 'item',
    fields: { allowed: ['id', 'title'] },
    relations: { allowed: ['owner'] },
    schemaMapping: { owner: 'user' },
});

// fields=email                 -> scope.path === ''             -> accepted
// fields[items.owner]=email    -> scope.path === 'items.owner'  -> rejected
```

### Batched validation with `validateMany`

Instead of `validate`, a sub-schema may declare `validateMany`, invoked **once per position** with every client key resolved there, so an authorization policy is compiled once instead of once per key:

```typescript
const userSchema = defineSchema<User, Actor>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email', 'salary'],
        validateMany: async (names, actor, scope) => {
            const permitted = await actor.permittedFields(scope.schema, names);

            return Object.fromEntries(
                names.map((name) => [name, permitted.includes(name)]),
            );
        },
    },
});
```

- **The batching unit is (governing schema, relation path).** One registered schema governing two positions of the same query (the root and `items.owner`) is asked twice; each position is a distinct authorization question, and each call sees its own `scope`.
- **`names` is the requested key set, not the effective projection.** Client-requested keys only, deduplicated, in the order they were recorded: never schema `default`s, never excluded fields (`-email`), never keys the allow-list already rejected.
- **A key absent from the returned record is rejected**, mirroring the `undefined`-rejects rule of the per-key hook. Accepted keys must be echoed explicitly. Keys you were not asked about are ignored.
- **The two hooks are mutually exclusive.** Declaring `validate` and `validateMany` on the same sub-schema throws a `SchemaError` (`ErrorCode.SCHEMA_KEY_VALIDATOR_CONFLICT`) when the schema is constructed, rather than silently shadowing one of them.

### Condition verdicts

A `fields` hook may answer with an `ICondition` instead of a boolean. The field is accepted and stays projected, but the condition rides along on the resulting `Field` node (`Field.condition`) and means: *this column is visible only on rows satisfying the condition*.

```typescript
import { eq } from '@rapiq/core';

const userSchema = defineSchema<User, Actor>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email', 'salary'],
        // everyone may ask for salary; only same-realm rows reveal it
        validate: (field, actor) => field !== 'salary' ||
            eq('realm_id', actor.realmId),
    },
});
```

::: warning A condition gates the value of a column, never the row set
The condition constrains **the value of that one field**. It never changes which rows the query returns, at the query root or under any relation path. Two rows that differ only in whether they satisfy the condition both come back; the gated column is simply absent from the one that doesn't. Anything else would turn a projection rule into a silent row filter.
:::

Where the gate is actually applied depends on the backend:

| Backend | Behavior |
|---|---|
| [`@rapiq/adapter-memory`](/packages/adapter-memory) | Honours `Field.condition` **while projecting**: the property is dropped from records that don't satisfy it. |
| [`@rapiq/adapter-sql`](/packages/adapter-sql), [`@rapiq/adapter-typeorm`](/packages/adapter-typeorm) | Project the column **unconditionally**. A selection has to stay a bare `alias.property` for entity hydration, so the gate cannot be pushed into the statement; it is applied **after the fetch**. |
| [`@rapiq/adapter-prisma`](/packages/adapter-prisma), [`@rapiq/adapter-drizzle`](/packages/adapter-drizzle) | Serialize plain argument objects, which cannot gate a value either; the gate is applied **after the fetch**. `PrismaAdapter.findMany()` refuses a gated query with a typed error instead of returning unredacted rows. |

::: danger The database backends fail open
On `@rapiq/adapter-sql` / `@rapiq/adapter-typeorm` (and on the prisma/drizzle serializers via `execute()`) the gated column is fetched for every row. Nothing is enforced until you apply the gate to the result; skip that step and the value ships to the client. Run the fetched rows through the post-fetch helper before serializing them:

```typescript
import { hasFieldConditions } from '@rapiq/core';
import { applyFieldConditions } from '@rapiq/adapter-memory';

const rows = await queryBuilder.getMany();
const guarded = applyFieldConditions(query.fields, rows);
```

`hasFieldConditions(query)` reports whether a decoded query carries any gate, so a response path can assert that no gated column ships unredacted. The SQL adapters and the prisma/drizzle serializers force-project every column a gate reads, so the post-fetch pass always has its operands even under a sparse fieldset or a fieldset-narrowed include.

For genuinely secret columns on an entity that is also reachable as an include, prefer a condition over a plain `return false`: a boolean denial only removes the field from the *query*, while a fieldset-free include still hydrates the whole record, leaving nothing for the post-fetch pass to act on. A condition keeps the gate attached to the field, so `applyFieldConditions` strips the value per row wherever the row came from.
:::

`sort` and `relations` have no column to gate, so a condition returned there is refused rather than silently ignored: it counts as a rejection and follows the failure policy. Narrowing the *rows* of an included relation is a separate, unrelated feature.

A gate is server-side state and has no wire form, so a query carrying one cannot be encoded: `encode()` throws `FEATURE_UNSUPPORTED` (`fields:condition`) on both URL dialects rather than emitting the bare field name, which would hand the next hop an ungated column. This only affects re-encoding a query you decoded server-side, for example to build pagination links; strip the gated fields first, or rebuild the link from the original input. The schema-aware encode pass is unaffected, since it discards the conditions its own validation round trip derives.

### Rules that apply to every hook

- **Target-schema authorization.** Hooks run on the canonical (alias-resolved) key against the schema that governs it: `include=items.realm` invokes the *user* schema's hook with `items` and the *item* schema's hook with `realm` (resolved via `schemaMapping`). An include can never bypass the related schema's own gate.
- **Relations are authorized wherever they are traversed, not only in `include=`.** A dotted `filters` / `fields` / `sort` key resolves through a relation the backends then auto-join (`filter[items.id]`, `fields[items]`, `sort=items.name`), so the `relations` hook runs for every relation *any* parameter reaches, evaluated **once per distinct relation** across the whole query (deduped with the include-driven checks). Rejecting the relation prunes every dependent key in every parameter together. There is a single authorization point for a join, regardless of which parameter forced it.
- **Rejection follows the failure policy.** Dropped by default, thrown (`ErrorCode.KEY_VALIDATE_REJECTED`) under [`throwOnFailure`](#failure-behavior-drop-vs-throw), naming the full client-facing path. A rejected relation also drops every deeper relation reached through it. A relation's authorization always follows the `relations` sub-schema's own policy, even when the relation was reached through a `filters`/`fields`/`sort` key.
- **Client input only.** Schema `default`s are server-authored and bypass the hooks. For `sort`, a hook that empties the selection leaves it empty (no ORDER BY). For `fields`, an empty selection would be read by every backend as *project everything*, so a hook that empties it falls back to the input-less projection (defaults, or the allow-list expansion) **minus the rejected names**: a denial never resurrects, and it never widens the projection either. A schema that uses a deny-capable fields hook should declare `fields.default` so the fallback has something safe to land on.
- **Sync/async mirrors the filters validator.** A hook returning a Promise requires the `parseAsync()`/`decodeAsync()` entry points; the sync paths refuse it with `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER`.
- **The context is opaque**: typed at the definition site via `defineSchema<RECORD, CONTEXT>` (and `SchemaRegistry<CONTEXT>`), forwarded verbatim from the parse options. Hooks receive `undefined` when the caller supplies none; there is no automatic fail-closed behavior, so a permission hook must guard the context itself and return `false` when it is missing rather than assume an actor is present.

The [filters `validate` hook](/guide/filters#schema-options) participates too: it receives the same context as its second argument. It has its own signature (it inspects, replaces or rejects a parsed `Filter`) and is not part of the key-validation hook pair described above.

## The registry & relations {#the-registry-relations}

The `SchemaRegistry` stores schemas by name and resolves relation paths through `schemaMapping`:

```typescript
const registry = new SchemaRegistry();
registry.add(realmSchema);
registry.add(userSchema);

registry.get('user');                 // Schema<User> | undefined
registry.getOrFail('user');           // throws if missing
registry.resolve('user', 'items');    // → 'item' schema, via schemaMapping
```

Hand the registry to a parser (or URL decoder) and reference schemas by name:

```typescript
import { SimpleParser } from '@rapiq/parser-simple';

const parser = new SimpleParser(registry);
const query = parser.parse(input, { schema: 'user' });
```

With the mapping above, input like `fields: { realm: ['name'] }` or `filters: { 'realm.name': 'master' }` is validated against the **realm** schema's allow-lists: each relation owner decides what may be requested of it.

## Describing a schema

`schema.describe()` serializes the declared constraints into a JSON-safe
`SchemaDescription`: the introspection surface an API can return to its
consumers (e.g. under a response `meta` key), so the queryable vocabulary
is discoverable without reading server code:

```typescript
userSchema.describe();
// {
//     name: 'user',
//     strict: false,
//     indexes: null,
//     fields: { default: ['id', 'name'], allowed: ['id', 'name', 'email', 'age'] },
//     filters: { allowed: ['id', 'name', 'age'], indexed: false },
//     pagination: { maxLimit: 50 },
//     relations: {
//         allowed: ['realm', 'items'],
//         schemas: { realm: 'realm', items: 'item' },
//     },
//     sort: { allowed: ['id', 'name', 'age'], default: { id: 'DESC' }, indexed: false },
// }
```

The shape is **normalized**: every schema describes identically, so
consumers can rely on a stable structure:

- a parameter key is present iff the description covers that parameter;
  pass `parameters` to mirror a surface that only processes some of them
  (e.g. a single-record read handling `fields` and `relations` only):
  `schema.describe({ parameters: [Parameter.FIELDS, Parameter.RELATIONS] })`.
  A covered parameter always carries every constraint key;
- within a parameter, a **`null`** constraint was never declared, so the
  fallback semantics apply (syntactic property-name check, or a full
  reject under [strict mode](#strict-mode); `strict` is normalized to
  its effective default, `false`);
- an **empty array** is an explicit "nothing allowed".

Relation capabilities are not expanded inline: `relations.schemas` names
the schema governing each relation (via `schemaMapping`; an unmapped
relation maps to itself, mirroring registry resolution); nested
vocabulary is looked up on that schema's own description.

Deliberately absent from the output: the filters `default` condition (a
server-injected baseline, not client vocabulary) and the dynamic
`validate`/`validateMany` hooks (e.g. per-actor authorization gates);
the description is the **static upper bound** of what a client may send,
not a per-request effective view. Arrays are cloned, so mutating a
description never touches the schema.

## Failure behavior: drop vs. throw

By default, parsers **drop** what the schema doesn't allow: the query still parses, minus the offending parts. That is the forgiving mode: old clients sending a removed field keep working.

With `throwOnFailure: true` (top-level or per parameter), parsers **throw** instead: the strict mode for APIs that prefer a `400` over a silently narrowed answer:

```typescript
import { FiltersParseError } from '@rapiq/core';

try {
    parser.parse({ filters: { secret: 'x' } }, { schema: 'user' });
} catch (e) {
    if (e instanceof FiltersParseError) {
        // e.code from ErrorCode, e.message names the offending key
    }
}
```

Each parameter has its own error class (`FieldsParseError`, `FiltersParseError`, `PaginationParseError`, `RelationsParseError`, `SortParseError`), all extending `ParseError`. The codes and an HTTP-mapping guide live in [Error Handling](/guide/errors).

## Next steps

- [Queries over the Wire](/guide/wire): where schemas meet incoming requests.
- [Query Parameters](/guide/fields): per-parameter schema options in context.
- [Error Handling](/guide/errors): the full error hierarchy and codes.

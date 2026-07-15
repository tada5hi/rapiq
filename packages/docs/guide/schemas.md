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

Field keys are typed against `RECORD` via recursive key paths — `allowed` and `default` autocomplete and type-check.

## Top-level options

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Registry key; also used to resolve nested schemas. |
| `throwOnFailure` | `boolean` | Throw on disallowed input instead of dropping it. Inherited by every sub-schema that doesn't set its own value. |
| `strict` | `boolean` | A parameter without an explicit allow-list rejects all client input instead of permitting any syntactically valid key. Inherited like `throwOnFailure`. See [Strict mode](#strict-mode). |
| `schemaMapping` | `Record<string, string>` | Maps a relation name to a registered schema name, so nested input (`realm.name`) validates against the related record's schema. |

## Per-parameter options

Every sub-schema also accepts its own `throwOnFailure` and `strict`.

| Parameter | Options |
|---|---|
| `fields` | `allowed`, `default`, `mapping` (alias → field) |
| `filters` | `allowed`, `default` (a default condition), `mapping`, `validate` (per-filter validation hook), `caseSensitive` ([exact-equality opt-out](/guide/filters#case-sensitivity)) |
| `relations` | `allowed`, `mapping` |
| `sort` | `allowed` (flat list, or list of lists to enforce exact multi-key combinations), `default`, `mapping` |
| `pagination` | `maxLimit` |

Standalone factories exist for each parameter — `defineFieldsSchema`, `defineFiltersSchema`, `defineRelationsSchema`, `defineSortSchema`, `definePaginationSchema` — useful when calling a single parameter parser directly.

::: tip Empty vs. absent
`allowed: []` blocks the parameter entirely; **omitting** `allowed` permits everything — unless [strict mode](#strict-mode) is on. Be deliberate about which one you mean.
:::

## Defaults

Defaults fill the gaps when a client sends nothing (or nothing valid) for a parameter:

- `fields.default` — the selection when no fields are requested; `+`/`-` modifiers in client input extend/shrink it instead of replacing it.
- `filters.default` — a condition applied when the client sends no filters.
- `sort.default` — the order applied when nothing valid was requested.
- `pagination.maxLimit` — doubles as the applied limit when the client requests none.

A parameter absent from the input is still parsed, so defaults always apply — even when the client sends nothing at all.

## Strict mode

By default, a parameter whose schema declares no allow-list is **open**: any syntactically valid key passes. `strict: true` inverts that — a parameter accepts client input only for explicitly declared keys:

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
| `pagination` | always — `maxLimit` remains the only constraint |

Schema defaults are unaffected: dropped client input falls back to `default` values exactly as if the parameter had been absent.

`strict` can also be set per parse call, overriding the schema setting — including parsing **without** a schema, which then rejects every client-driven parameter:

```typescript
parser.parse(input, { schema: 'user', strict: true });
```

::: warning Migrating from typeorm-extension?
typeorm-extension **disables** any parameter whose `allowed`/`default` options are missing. rapiq's default is the opposite (open). Enable `strict: true` to keep closed-by-default semantics — see the [migration guide](/guide/migration-typeorm-extension).
:::

## The registry & relations

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

With the mapping above, input like `fields: { realm: ['name'] }` or `filters: { 'realm.name': 'master' }` is validated against the **realm** schema's allow-lists — each relation owner decides what may be requested of it.

## Failure behavior: drop vs. throw

By default, parsers **drop** what the schema doesn't allow — the query still parses, minus the offending parts. That is the forgiving mode: old clients sending a removed field keep working.

With `throwOnFailure: true` (top-level or per parameter), parsers **throw** instead — the strict mode for APIs that prefer a `400` over a silently narrowed answer:

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

Each parameter has its own error class — `FieldsParseError`, `FiltersParseError`, `PaginationParseError`, `RelationsParseError`, `SortParseError` — all extending `ParseError`. The codes and an HTTP-mapping guide live in [Error Handling](/guide/errors).

## Next steps

- [Queries over the Wire](/guide/wire) — where schemas meet incoming requests.
- [Query Parameters](/guide/fields) — per-parameter schema options in context.
- [Error Handling](/guide/errors) — the full error hierarchy and codes.

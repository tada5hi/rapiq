# Schemas

A `Schema<RECORD>` is the server-side allow-list: it declares what a client may request, per parameter. Parsers consult it during parsing — anything outside the allow-lists is silently dropped, or throws when `throwOnFailure` is set.

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
| `strict` | `boolean` | A parameter without an explicit allow-list rejects all client input instead of permitting any syntactically valid key. Inherited by every sub-schema that doesn't set its own value. See [Strict mode](#strict-mode). |
| `schemaMapping` | `Record<string, string>` | Maps a relation name to a registered schema name, so nested input (`realm.name`) validates against the related record's schema. |

## Per-parameter options

Every sub-schema also accepts its own `throwOnFailure` and `strict`.

| Parameter | Options |
|---|---|
| `fields` | `allowed`, `default`, `mapping` (alias → field) |
| `filters` | `allowed`, `default` (a default condition), `mapping`, `validate` (per-filter validation hook) |
| `relations` | `allowed`, `mapping` |
| `sort` | `allowed` (flat list, or list of lists to enforce exact multi-key combinations), `default`, `mapping` |
| `pagination` | `maxLimit` |

Standalone factories exist for each parameter — `defineFieldsSchema`, `defineFiltersSchema`, `defineRelationsSchema`, `defineSortSchema`, `definePaginationSchema` — useful when calling a single parameter parser directly.

::: tip
`allowed: []` blocks the parameter entirely; **omitting** `allowed` permits everything — unless [strict mode](#strict-mode) is on. Be deliberate about which one you mean.
:::

## Strict mode

By default, a parameter whose schema declares no allow-list is **open**: any syntactically valid key passes. `strict: true` inverts that default — a parameter accepts client input only for explicitly declared keys, and everything else is dropped (or thrown, with `throwOnFailure`):

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
parser.parse(input, { strict: true });   // schema-required parsing: everything is dropped
```

::: warning Migrating from typeorm-extension
typeorm-extension **disables** any parameter whose `allowed`/`default` options are missing. rapiq's default is the opposite (open). Enable `strict: true` on your schemas to keep the closed-by-default semantics when migrating.
:::

## The registry

The `SchemaRegistry` stores schemas by name and resolves relation paths through `schemaMapping`:

```typescript
const registry = new SchemaRegistry();
registry.add(realmSchema);
registry.add(userSchema);

registry.get('user');                 // Schema<User> | undefined
registry.getOrFail('user');           // throws if missing
registry.resolve('user', 'items');    // → 'item' schema, via schemaMapping
```

Hand the registry to a parser and reference schemas by name:

```typescript
import { SimpleParser } from '@rapiq/parser-simple';

const parser = new SimpleParser(registry);
const query = parser.parse(input, { schema: 'user' });
```

With the mapping above, input like `fields: { realm: ['name'] }` or `filters: { 'realm.name': 'master' }` is validated against the **realm** schema's allow-lists.

## Failure behavior

By default, parsers drop what the schema doesn't allow — the query still parses, minus the offending parts. With `throwOnFailure: true` (top-level or per parameter), parsers throw instead:

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

Each parameter has its own error class: `FieldsParseError`, `FiltersParseError`, `PaginationParseError`, `RelationsParseError`, `SortParseError` — all extend `ParseError` → `BaseError`.

Disallowed keys throw `keyNotPermitted` (`ErrorCode.KEY_NOT_ALLOWED`); syntactically invalid keys under an open schema throw `keyInvalid` (`KEY_INVALID`); rejected or unresolvable relation paths throw `keyPathInvalid` (`KEY_PATH_INVALID`).

## Resolution scope

Parsers resolve raw client keys through a `ResolutionScope` — an immutable handle on one parameter of one schema, under one failure policy. It owns alias mapping, allow-list verdicts, relation traversal through the registry (`schemaMapping`-aware) and the throw-vs-drop policy. Custom parsers and tooling can use it directly:

```typescript
import { Parameter, ResolutionScope } from '@rapiq/core';

const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');

const resolved = scope.resolveKey('items.id');
// { ok: true, name: 'id', path: ['items'], scope: <scope of the item schema> }

const rejected = scope.resolveKey('secret');
// { ok: false, code: 'keyNotPermitted', input: 'secret', segment: 'secret' }
```

`resolveKey()` resolves a local, aliased or dotted key and reports the outcome as a discriminated union (or throws the parameter's error class when `throwOnFailure` applies). `descend()` enters a relation segment and returns a child scope bound to the related schema.

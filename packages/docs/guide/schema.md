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
| `schemaMapping` | `Record<string, string>` | Maps a relation name to a registered schema name, so nested input (`realm.name`) validates against the related record's schema. |

## Per-parameter options

Every sub-schema also accepts its own `throwOnFailure`.

| Parameter | Options |
|---|---|
| `fields` | `allowed`, `default`, `mapping` (alias → field) |
| `filters` | `allowed`, `default` (a default condition), `mapping`, `validate` (per-filter validation hook) |
| `relations` | `allowed`, `mapping` |
| `sort` | `allowed` (flat list, or list of lists to enforce exact multi-key combinations), `default`, `mapping` |
| `pagination` | `maxLimit` |

Standalone factories exist for each parameter — `defineFieldsSchema`, `defineFiltersSchema`, `defineRelationsSchema`, `defineSortSchema`, `definePaginationSchema` — useful when calling a single parameter parser directly.

::: tip
`allowed: []` blocks the parameter entirely; **omitting** `allowed` permits everything. Be deliberate about which one you mean.
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

# Relations

Load related resources alongside the primary one — and unlock their fields for [selection](/guide/fields), [filtering](/guide/filters) and [sorting](/guide/sort).

| | |
|---|---|
| URL key | `include` |
| AST nodes | `Relations` / `Relation { name }` |
| Schema options | `allowed`, `mapping` |

## On the wire

```txt
include=realm,items           comma-separated
include=items.realm           nested path (dot notation)
```

Parser input shapes:

```typescript
{ relations: 'realm,items' }        // comma-separated string
{ relations: ['realm', 'items'] }   // array
{ relations: ['items.realm'] }      // nested paths
```

Nested paths automatically include their parents — requesting `items.realm` also includes `items`.

## Building in code

```typescript
defineQuery<User>({ relations: ['items.realm'] });

// record form works too
defineQuery<User>({ relations: { realm: true, items: { user: true } } });

defineRelations<User>(['realm']);   // standalone fragment
```

## Validation

Each requested relation is checked against the schema's `allowed` list. Nested paths resolve segment by segment through [`schemaMapping`](/guide/schemas#the-registry--relations): for `items.realm`, the `items` segment must be allowed on the root schema and `realm` on the schema registered for `items`.

Relation names must match `[a-zA-Z0-9_-]` segments separated by dots — anything else is dropped (or throws with `throwOnFailure`).

## Schema options

```typescript
defineSchema<User>({
    relations: {
        allowed: ['realm', 'items'],
        mapping: { children: 'items' },
    },
    schemaMapping: {
        items: 'item',
        realm: 'realm',
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Traversable relation names. Omit to allow all; `[]` blocks the parameter. |
| `mapping` | Alias → relation translation applied before validation. |

## Interaction with other parameters

Parsed relations feed back into the other parameter parsers: fields, filters and sort input that addresses a relation (`items.id`, `realm.name`) is only accepted when the relation was requested and allowed. Request the relation first, then reference its fields.

## On violation

Disallowed or invalid relation input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `RelationsParseError` instead.

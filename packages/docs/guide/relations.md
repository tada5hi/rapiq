# Relations

Include related resources of the primary resource.

- **URL parameter**: `include`
- **AST nodes**: `Relations` / `Relation { name }`

## Input formats

```typescript
// comma-separated string
{ relations: 'realm,items' }

// array
{ relations: ['realm', 'items'] }

// nested paths with dot notation
{ relations: ['items.realm'] }
```

Nested paths automatically include their parents — requesting `items.realm` also includes `items`.

::: info Client-side construction
The same shapes work as typed build input — `defineQuery<User>({ relations: ['items.realm'] })` or the `defineRelations<User>(...)` fragment factory build the AST directly; a record form (`{ realm: true, items: { user: true } }`) is also accepted. See [Building Queries](/guide/build).
:::

## Validation

Each requested relation is checked against the schema's `allowed` list. Nested paths resolve segment by segment through [`schemaMapping`](/guide/schema#the-registry): for `items.realm`, the `items` segment must be allowed on the root schema and `realm` on the schema registered for `items`.

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

On violation: dropped silently, or `RelationsParseError` with `throwOnFailure`.

## Interaction with other parameters

Parsed relations feed back into the other parameter parsers: fields, filters and sort input that addresses a relation (`items.id`, `realm.name`) is only accepted when the relation was requested and allowed.

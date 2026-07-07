# Fields

Return only specific resource fields, or extend the default selection.

- **URL parameter**: `fields`
- **AST nodes**: `Fields` / `Field { name, operator? }`

## Input formats

Accepted by [`SimpleParser`](/integrations/simple) (and, in URL form, by the [URL codec](/integrations/url)):

```typescript
// comma-separated string
{ fields: 'id,name,email' }

// array of names
{ fields: ['id', 'name'] }

// record keyed by relation — values follow the same rules
{
    fields: {
        items: ['id', 'name'],
        'items.realm': ['id'],
    },
}

// tuple: base fields + per-relation record
{
    fields: [
        ['id', 'name'],
        { items: ['id'] },
    ],
}
```

::: info Client-side construction
The same shapes work as typed build input — `defineQuery<User>({ fields: ['id', '+email'] })` or the `defineFields<User>(...)` fragment factory build the AST directly, with field paths checked against the record type. See [Building Queries](/guide/build).
:::

## Include & exclude operators

A field name can carry a prefix:

| Syntax | Meaning |
|---|---|
| `name` | Select this field. |
| `+name` | Explicitly **include** — extends the schema's `default` selection instead of replacing it. |
| `-name` | Explicitly **exclude** — removes the field from the selection. |

```typescript
// defaults are { default: ['id', 'name'] } —
// keep them and additionally select email:
{ fields: '+email' }

// drop name from the defaults:
{ fields: '-name' }
```

In the AST, the prefix becomes `Field.operator` (`FieldOperator.INCLUDE` / `FieldOperator.EXCLUDE`).

## Relation fields

Fields of related records use the relation name as key (or a `relation.field` path) and validate against the related schema, resolved through [`schemaMapping`](/guide/schema#the-registry). The relation itself must be allowed and requested via [relations](/guide/relations).

## Schema options

```typescript
defineSchema<User>({
    fields: {
        allowed: ['id', 'name', 'email', 'age'],
        default: ['id', 'name'],
        mapping: { displayName: 'name' },
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Selectable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Selection when the client sends nothing (or only `+`/`-` modifiers). |
| `mapping` | Alias → field translation applied before validation. |

On violation: dropped silently, or `FieldsParseError` with `throwOnFailure`.

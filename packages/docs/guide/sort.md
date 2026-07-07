# Sort

Sort the resources by one or more keys, ascending or descending.

- **URL parameter**: `sort`
- **AST nodes**: `Sorts` / `Sort { name, operator: 'ASC' | 'DESC' }`

## Input formats

```typescript
// string — `-` prefix means descending
{ sort: '-age' }

// multiple keys, applied in order
{ sort: 'name,-age' }

// array
{ sort: ['name', '-age'] }

// object with explicit directions (case-insensitive)
{ sort: { name: 'ASC', age: 'DESC' } }

// nested record for relation fields
{ sort: { id: 'DESC', items: { id: 'ASC' } } }
```

In URL form this is `sort=name,-age`.

::: info Client-side construction
The same shapes work as typed build input — `defineQuery<User>({ sort: '-age' })` or the `defineSorts<User>(...)` fragment factory build the AST directly, with keys checked against the record type. See [Building Queries](/guide/build).
:::

## Relation fields

`relation.field` keys (or nested records, as above) sort by a related record's field. The relation must be requested and allowed, and the field validates against the related schema via [`schemaMapping`](/guide/schema#the-registry).

## Schema options

```typescript
defineSchema<User>({
    sort: {
        allowed: ['id', 'name', 'age'],
        default: { id: 'DESC' },
        mapping: { createdAt: 'created_at' },
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Sortable field names. A nested list (`[['name', 'age']]`) only permits exactly those multi-key combinations. Omit to allow all; `[]` blocks the parameter. |
| `default` | Sort order applied when the client sends nothing valid. |
| `mapping` | Alias → field translation applied before validation. |

On violation: dropped silently, or `SortParseError` with `throwOnFailure`.

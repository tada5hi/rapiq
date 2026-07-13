# Sort

Order the collection by one or more keys, ascending or descending.

| | |
|---|---|
| URL key | `sort` |
| AST nodes | `Sorts` / `Sort { name, operator: 'ASC' \| 'DESC' }` |
| Schema options | `allowed`, `default`, `mapping` |

## On the wire

```txt
sort=-age                     `-` prefix = descending
sort=name,-age                multiple keys, applied in order
sort=items.id                 relation field
```

Parser input shapes:

```typescript
{ sort: '-age' }                              // string
{ sort: 'name,-age' }                         // comma list
{ sort: ['name', '-age'] }                    // array
{ sort: { name: 'ASC', age: 'DESC' } }        // record (case-insensitive)
{ sort: { id: 'DESC', items: { id: 'ASC' } } } // nested record
```

## Building in code

```typescript
defineQuery<User>({ sort: '-age' });
defineQuery<User>({ sort: { created_at: 'DESC', realm: { name: 'ASC' } } });

defineSorts<User>(['-age']);   // standalone fragment
```

Keys are checked against the record type.

## Relation fields

`relation.field` keys (or nested records) sort by a related record's field. The relation must be requested and allowed, and the field validates against the related schema via [`schemaMapping`](/guide/schemas#the-registry--relations).

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
| `allowed` | Sortable field names. A nested list (`[['name', 'age']]`) only permits exactly those multi-key combinations — useful when only certain composite indexes exist. Omit to allow all; `[]` blocks the parameter. |
| `default` | Sort order applied when the client sends nothing valid. |
| `mapping` | Alias → field translation applied before validation. |

## On violation

Disallowed or invalid sort input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `SortParseError` instead.

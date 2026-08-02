# Sort

Order the collection by one or more keys, ascending or descending.

| | |
|---|---|
| URL key | `sort` |
| AST nodes | `Sorts` / `Sort { name, operator: 'ASC' \| 'DESC' }` |
| Schema options | `allowed`, `default`, `mapping`, `validate` / `validateMany` |

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

`relation.field` keys (or nested records) sort by a related record's field. The relation must be requested and allowed, and the field validates against the related schema via [`schemaMapping`](/guide/schemas#the-registry-relations).

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
| `allowed` | Sortable field names. A nested list (`[['name', 'age']]`) only permits exactly those multi-key combinations, useful when only certain composite indexes exist. Omit to allow all; `[]` blocks the parameter. |
| `default` | Sort order applied when the client sends nothing valid. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` / `validateMany` | Per-request [key hooks](/guide/schemas#validate-hooks-parse-context): accept or reject a sort key per actor. |

## Validate hooks

A `validate` / `validateMany` hook runs once per client-requested sort key, against the schema that governs it (the target schema for dotted keys such as `items.id`) and after tuple-group matching. Schema `default`s are server-authored and bypass the hook. The general contract (verdicts, the scope argument, batching, sync/async) lives at [Validate hooks and parse context](/guide/schemas#validate-hooks-parse-context).

An ordering is not a row set, so there is nothing for an `ICondition` verdict to gate: a condition answer counts as a rejection for sort (only `fields` hooks may gate with a condition).

## On violation

Disallowed or invalid sort input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `SortParseError` instead.

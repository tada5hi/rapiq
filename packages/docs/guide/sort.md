# Sorts

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

::: tip Naming
The input key is `sorts`, matching the `Query.sorts` AST property and the
`FieldsSchema`/`FiltersSchema` naming of the other parameters. The older
`sort` key is still accepted and will be removed in 3.0. The URL wire
parameter stays `sort`, exactly as `filters` is carried as `filter`.
Supplying both `sorts` and `sort` in the same input throws `KEY_AMBIGUOUS`,
unconditionally and regardless of `throwOnFailure`, on `defineQuery`,
`defineSchema` and every parser/codec `parse()`/`decode()` call: the two
spellings name one parameter, and picking a winner would silently drop
the other.
:::

Parser input shapes:

```typescript
{ sorts: '-age' }                              // string
{ sorts: 'name,-age' }                         // comma list
{ sorts: ['name', '-age'] }                    // array
{ sorts: { name: 'ASC', age: 'DESC' } }        // record (case-insensitive)
{ sorts: { id: 'DESC', items: { id: 'ASC' } } } // nested record
```

## Building in code

```typescript
defineQuery<User>({ sorts: '-age' });
defineQuery<User>({ sorts: { created_at: 'DESC', realm: { name: 'ASC' } } });

defineSorts<User>(['-age']);   // standalone fragment
```

Keys are checked against the record type.

## Relation fields

`relation.field` keys (or nested records) sort by a related record's field. The relation must be requested and allowed, and the field validates against the related schema via [`schemaMapping`](/guide/schemas#the-registry-relations).

## Schema options

```typescript
defineSchema<User>({
    sorts: {
        allowed: ['id', 'name', 'age'],
        default: { id: 'DESC' },
        mapping: { createdAt: 'created_at' },
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Sortable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Sort order applied when the client sends nothing valid. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` / `validateMany` | Per-request [key hooks](/guide/schemas#validate-hooks-parse-context): accept or reject a sort key per actor. |
| `indexed` | Requested keys must form a leftmost prefix of one declared schema [index](/guide/schemas#indexes), in order; directions are ignored and keys must share one relation path. Replaces the removed nested-list form of `allowed`. |

## Validate hooks

A `validate` / `validateMany` hook runs once per client-requested sort key, against the schema that governs it (the target schema for dotted keys such as `items.id`) and before the [index policy](/guide/schemas#indexes) is applied. Schema `default`s are server-authored and bypass the hook. The general contract (verdicts, the scope argument, batching, sync/async) lives at [Validate hooks and parse context](/guide/schemas#validate-hooks-parse-context). The hook's `scope.parameter` is `'sorts'` (it used to be `'sort'`), so a hook factory shared with `fields` that branches on that value needs updating.

An ordering is not a row set, so there is nothing for an `ICondition` verdict to gate: a condition answer counts as a rejection for sort (only `fields` hooks may gate with a condition).

## On violation

Disallowed or invalid sort input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `SortsParseError` instead.

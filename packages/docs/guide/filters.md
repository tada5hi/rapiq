# Filters

Filter the resources according to specific criteria.

- **URL parameter**: `filter`
- **AST nodes**: `Filters` (compound `and`/`or`) / `Filter { operator, field, value }`

## Input format

The simple dialect takes an object — keys are field names (or `relation.field` paths), values encode the operator:

```typescript
{
    filters: {
        id: 1,                  // equal
        name: '~jo~',           // contains
        age: '>=18',            // greater than or equal
        'realm.name': 'master', // nested field (relation must be allowed)
    },
}
```

Multiple keys combine with **and**.

## Operator syntax

| Value | Operator | AST operator |
|---|---|---|
| `1`, `'admin'` | equal | `EQUAL` |
| `'!admin'` | not equal | `NOT_EQUAL` |
| `'<18'` | less than | `LESS_THAN` |
| `'<=18'` | less than or equal | `LESS_THAN_EQUAL` |
| `'>18'` | greater than | `GREATER_THAN` |
| `'>=18'` | greater than or equal | `GREATER_THAN_EQUAL` |
| `'1,2,3'` or `[1, 2, 3]` | in list | `IN` |
| `'!1,2,3'` | not in list | `NOT_IN` |
| `'jo~'` | starts with | `STARTS_WITH` |
| `'!jo~'` | not starts with | `NOT_STARTS_WITH` |
| `'~jo'` | ends with | `ENDS_WITH` |
| `'!~jo'` | not ends with | `NOT_ENDS_WITH` |
| `'~jo~'` | contains | `CONTAINS` |
| `'!~jo~'` | not contains | `NOT_CONTAINS` |
| `'null'` / `null` | equal null | `EQUAL` |
| `'!null'` | not equal null | `NOT_EQUAL` |

Value coercion: numeric strings become numbers (`'18'` → `18`), `'true'`/`'false'` become booleans, `'null'` becomes `null`.

::: tip OR conditions
The simple object dialect combines keys with **and**. For `or` combinations, use the [condition helpers](/guide/build#condition-helpers) (`or(gte('age', 18), eq('status', 'active'))`), build the `Filters` tree [by hand](/guide/query#filters-form-a-tree) or use the [expression language](/integrations/expression).
:::

::: info Client-side construction
The string prefixes above are the *wire* format. When building queries in code, use [`defineQuery`](/guide/build)'s typed operator objects (`{ age: { $gte: 18 } }`) or condition helpers instead of magic strings.
:::

## Nested fields

`relation.field` keys filter on related records. The relation must be permitted by the [relations schema](/guide/relations), and the field validates against the related schema via [`schemaMapping`](/guide/schema#the-registry).

## Schema options

```typescript
defineSchema<User>({
    filters: {
        allowed: ['id', 'name', 'age'],
        mapping: { aliasId: 'id' },
        default: new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Filterable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Condition applied when the client sends no filters. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` | Per-filter hook — inspect/replace a parsed `Filter`, or reject it. |

On violation: dropped silently, or `FiltersParseError` with `throwOnFailure`.

# Filters

Narrow the collection by conditions on fields — from a simple equality to arbitrary `and`/`or` trees.

| | |
|---|---|
| URL key | `filter` |
| AST nodes | `Filters` (compound `and`/`or`) / `Filter { operator, field, value }` |
| Schema options | `allowed`, `default`, `mapping`, `validate` |

## Operators

Every dialect maps onto the same operator set (`FilterFieldOperator`):

| Operator | Meaning | Build key | Helper | Simple wire |
|---|---|---|---|---|
| `EQUAL` | equals | `$eq` / bare scalar | `eq` | `admin`, `1`, `null` |
| `NOT_EQUAL` | not equals | `$ne` | `ne` | `!admin` |
| `LESS_THAN` | `<` | `$lt` | `lt` | `<18` |
| `LESS_THAN_EQUAL` | `<=` | `$lte` | `lte` | `<=18` |
| `GREATER_THAN` | `>` | `$gt` | `gt` | `>18` |
| `GREATER_THAN_EQUAL` | `>=` | `$gte` | `gte` | `>=18` |
| `IN` | in list | `$in` / bare array | `inArray` | `1,2,3` |
| `NOT_IN` | not in list | `$nin` | `nin` | `!1,2,3` |
| `STARTS_WITH` | prefix | `$startsWith` | `startsWith` | `jo~` |
| `NOT_STARTS_WITH` | not prefix | `$notStartsWith` | `notStartsWith` | `!jo~` |
| `ENDS_WITH` | suffix | `$endsWith` | `endsWith` | `~jo` |
| `NOT_ENDS_WITH` | not suffix | `$notEndsWith` | `notEndsWith` | `!~jo` |
| `CONTAINS` | substring | `$contains` | `contains` | `~jo~` |
| `NOT_CONTAINS` | not substring | `$notContains` | `notContains` | `!~jo~` |
| `REGEX` | pattern | `$regex` | `regex` | — |
| `MOD` | divisible remainder | `$mod` | `mod` | — |
| `EXISTS` | is not null | `$exists` | `exists` | — |
| `ELEM_MATCH` | array element match | `$elemMatch` | `elemMatch` | — |

The last four have no representation in the URL dialects — they work in code, via the [MongoDB-style parser](/packages/parser-mongo), and in every [adapter](/guide/executing-queries).

## On the wire (simple dialect)

Keys are field names (or `relation.field` paths); the value string encodes the operator:

```
filter[id]=1                  equal
filter[name]=~jo~             contains
filter[age]=>=18              greater than or equal
filter[realm.name]=master     nested field
filter[id]=1,2,3              in list
filter[email]=!null           not null
```

Multiple keys combine with **and**. Scalar coercion applies on decode: `'18'` → `18`, `'true'` → `true`, `'null'` → `null`.

::: info Wire strings vs. code
The `!`/`<`/`~` prefixes are the *wire* format. In code, use typed operator objects (`{ age: { $gte: 18 } }`) or condition helpers — never magic strings.
:::

## Building in code

The full grammar is covered in [Building Queries](/guide/building-queries); the short version:

```typescript
import { and, defineQuery, eq, gte, or } from '@rapiq/core';

defineQuery<User>({
    filters: {
        name: 'John',                 // scalar → eq
        realm_id: [1, null],          // array → in (null is legal)
        age: { $gte: 18, $lt: 65 },   // operator object
    },
});

defineQuery<User>({
    filters: or(gte('age', 18), eq('deleted_at', null)),   // condition trees
});
```

## OR & compound trees

The simple object/wire dialect only expresses flat **and** sets. For `or` and nested groups:

- **in code** — condition helpers: `or(...)`, `and(...)`, arbitrarily nested;
- **over a URL** — the [expression codec](/packages/codec-url-expression): `filter=or(gte(age,'18'),eq(status,'active'))`;
- **in a request body** — the [MongoDB-style parser](/packages/parser-mongo): `{ $or: [...] }`.

## Nested fields

`relation.field` keys filter on related records. The relation must be permitted and requested via [relations](/guide/relations), and the field validates against the related schema through [`schemaMapping`](/guide/schemas#the-registry--relations).

## Null semantics

`null` is a first-class filter value with SQL-consistent behavior across all adapters:

| Filter | Meaning |
|---|---|
| `eq(field, null)` | `field IS NULL` |
| `ne(field, null)` | `field IS NOT NULL` |
| `inArray(field, [a, null])` | `field IN (…) OR field IS NULL` |
| `exists(field)` | `field IS NOT NULL` |

## Schema options

```typescript
defineSchema<User>({
    filters: {
        allowed: ['id', 'name', 'age'],
        mapping: { aliasId: 'id' },
        default: eq('status', 'active'),
        validate: (filter) => { /* inspect / replace / reject a parsed Filter */ },
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Filterable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Condition applied when the client sends no filters. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` | Per-filter hook — inspect/replace a parsed `Filter`, or reject it. |

## On violation

Disallowed or invalid filter input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `FiltersParseError` instead. Grammar errors in the expression and MongoDB-style dialects always throw — see [Error Handling](/guide/errors).

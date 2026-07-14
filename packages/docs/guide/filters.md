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

```txt
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
        'realm.id': [1, null],        // array → in (null is legal)
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

Negated operators (`ne`, `nin`, `notContains`, `notStartsWith`, `notEndsWith`) are **exact complements** of their positive twins — they also match records where the field is `NULL`/absent. Adapters render them null-inclusively, e.g. `ne(field, a)` → `(field <> ? OR field IS NULL)`.

## Case sensitivity

String matching is **case-insensitive by default**, uniformly across every adapter — the same query matches the same records whether it runs on Postgres, MySQL, in memory, or through TypeORM:

- The **equality family** (`eq`, `ne`, `in`, `nin`) compares string values case-insensitively: `eq('name', 'super hero')` matches `Super Hero`. Non-string values (numbers, booleans, dates, `null`) are unaffected.
- The **anchored operators** (`contains`, `startsWith`, `endsWith` and their negations) match case-insensitively as well.
- **Range comparisons** (`lt`/`lte`/`gt`/`gte`) and `sort` follow the backend's collation — rapiq does not fold string ordering.

Opt out per field with the `caseSensitive` schema option where exactness matters — identifiers, tokens, enum-like codes:

```typescript
const schema = defineSchema<User>({
    filters: {
        allowed: ['id', 'name'],
        caseSensitive: ['id'],
    },
});
```

The receiving side forwards the list to its adapter:

```typescript
// @rapiq/sql & @rapiq/typeorm
adapter.execute(query, { visitor: { caseSensitive: schema.filters.caseSensitive } });

// @rapiq/memory
applyQuery(query, data, { filters: { caseSensitive: schema.filters.caseSensitive } });
```

Under the hood, `@rapiq/sql` folds both sides of the comparison — `lower(field) = lower(?)` — and only when the filter value is a string. Dialects whose plain `=` already compares case-insensitively under their default collation (the MySQL and MSSQL presets) skip the folding through the `caseFold` dialect option, so plain indexes stay usable. On folding dialects (Postgres, SQLite, Oracle), add an expression index for hot string filter columns — `CREATE INDEX ON "user" (lower(name))` — or list the column in `caseSensitive`.

The TypeORM adapter goes one step further: it resolves each filtered field against the entity metadata and folds **only string-typed columns**. Numeric, date, uuid or enum columns never pay the `lower()` cost — even when the value arrives as an untyped wire string like `filter[age]=18`.

::: warning Collation wins on MySQL/MSSQL
On the MySQL/MSSQL presets, equality delegates to the column collation: `caseSensitive` cannot force exactness onto a `*_ci` collated column. Use a `*_bin`/`*_cs` collation for such columns, or override `caseFold` with a `lower()`-wrapping implementation.
:::

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
| `caseSensitive` | Fields whose equality comparisons stay exact instead of the [case-insensitive default](#case-sensitivity). |

`validate` runs synchronously after key resolution, mapping and value coercion. Return the original filter to accept it, another `Filter` to replace it, or `undefined` to reject that leaf. Compound `and`/`or` structure is preserved; if every submitted leaf is rejected, the schema default is applied.

## On violation

Disallowed or invalid filter input is dropped silently; with [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw) it throws a `FiltersParseError` instead. Grammar errors in the expression and MongoDB-style dialects always throw — see [Error Handling](/guide/errors).

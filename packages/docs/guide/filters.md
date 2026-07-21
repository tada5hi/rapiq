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
| `SIZE` | array length | `$size` | `size` | — |
| `EXISTS` | is not null | `$exists` | `exists` | — |
| `ELEM_MATCH` | array element match | `$elemMatch` | `elemMatch` | — |

`REGEX`, `MOD` and `EXISTS` have no representation in the URL dialects — they work in code, via the [MongoDB-style parser](/packages/parser-mongo), and in every [adapter](/guide/executing-queries). Before accepting `regex` from untrusted input, read the [trust model](#regex-trust-model) below. `ELEM_MATCH` and `SIZE` travel in the [expression dialect](/packages/parser-expression) only.

`SIZE` matches arrays with exactly the given number of elements (a non-negative integer); missing or non-array values never match, and there is no negated form. It evaluates in [`@rapiq/memory`](/packages/memory) — the SQL adapters throw a typed `featureUnsupported` until dialect-level JSON-array support lands.

Inside an `elemMatch` interior, the reserved `ITSELF` marker (wire spelling `$this`) may take the field position of a condition to address the array element itself: `elemMatch('scores', gt(ITSELF, 5))` matches when some score is greater than five. `@rapiq/memory` evaluates it element-wise; the SQL adapters throw a typed `featureUnsupported` (a joined relation row is not a scalar column). Anywhere outside an `elemMatch` interior the marker is a typed error.

## On the wire (expression dialect)

The URL codec writes one expression by default, preserving compound structure and repeated fields:

```txt
codec=url-expression&filter=and(gte(age,'18'),or(eq(status,'active'),eq(status,'pending')))
```

The function names mirror the condition helpers in the table above. Values are single-quoted; quote characters escape by doubling (`'it''s'`).

## Legacy simple input

Keys are field names (or `relation.field` paths); the value string encodes the operator:

```txt
filter[id]=1                  equal
filter[name]=~jo~             contains
filter[age]=>=18              greater than or equal
filter[realm.name]=master     nested field
filter[id]=1,2,3              in list
filter[email]=!null           not null
```

The v2 codec continues to decode this shape for existing clients. Multiple keys combine with **and**. Scalar coercion applies on decode: `'18'` → `18`, `'true'` → `true`, `'null'` → `null`.

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

The simple object/wire dialect only expresses flat **and** sets. For `or`, `not` and nested groups:

- **in code** — condition helpers: `or(...)`, `and(...)`, `not(...)`, arbitrarily nested;
- **over a URL** — the [expression codec](/packages/codec-url#expression-dialect): `filter=or(gte(age,'18'),eq(status,'active'))`;
- **in a request body** — the [MongoDB-style parser](/packages/parser-mongo): `{ $or: [...] }`.

### Negation

`not(condition)` matches exactly the records its interior does **not** match — the
[complement law](#null-semantics) extended from the negated leaf operators to arbitrary trees:

```typescript
import { and, defineQuery, eq, gt, not } from '@rapiq/core';

defineQuery<User>({
    filters: not(and(eq('status', 'active'), gt('age', 65))),
});
```

Where a negated leaf operator exists, `not` is the same condition (`not(eq(…))` ≡ `ne(…)`);
its value is negating conditions **without** a negated twin — ordering comparisons
(`not(gt(…))`), `size`, `elemMatch` and whole groups. Multiple arguments negate their
conjunction: `not(a, b)` ≡ `not(and(a, b))`.

On the wire, the expression dialect carries it as `filter=not(gt(age,'65'))`; the legacy
simple dialect cannot express it (encoding throws a typed error). SQL adapters render the
negation **null-inclusively** (a `CASE` wrapper collapses SQL's three-valued `UNKNOWN` to
false), so a record with `age = NULL` matches `not(gt('age', 65))` on every backend — the
same verdict `@rapiq/memory` produces.

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

The same complement law governs [`not(...)`](#negation) over whole trees: `not(c)` selects exactly the records `c` does not, on every backend.

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
        // accept (return the filter), replace (return another Filter),
        // or reject (return undefined) — a hook that returns nothing
        // rejects every filter.
        validate: async (filter) => filter,
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Filterable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Condition applied when the client sends no filters. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` | Sync or async per-filter hook — inspect/replace a parsed `Filter`, or reject it. Receives the [parse context](/guide/schemas#validate-hooks--parse-context) as its second argument. |
| `caseSensitive` | Fields whose equality comparisons stay exact instead of the [case-insensitive default](#case-sensitivity). |

`validate` runs after key resolution, mapping and value coercion, and receives the caller-supplied [`context`](/guide/schemas#validate-hooks--parse-context) (e.g. the authenticated actor) as its second argument. Return the original filter to accept it, another `Filter` to replace it, or `undefined` to reject that leaf — an inspect-only hook must still `return` the filter, otherwise every leaf is rejected. `$elemMatch` conditions are validated inside-out: every interior leaf passes the hook, then the `elemMatch` filter itself. The return value may also be a Promise of any of those results. On the server, [schema-aware encoding](/packages/codec-url) re-runs the schema-bound decoder, so a validator that is not idempotent (e.g. one that appends to the value) transforms a filter twice between a schema-aware `encode()` and the receiving `decode()` — keep validators idempotent.

Use the synchronous `parse()` / `decode()` / schema-aware `encode()` methods when every validator is synchronous. Use their `Async` counterparts when a validator may be asynchronous:

```typescript
const query = await parser.parseAsync(input, { schema });
const decoded = await codec.decodeAsync(req.query, { schema });
const encoded = await codec.encodeAsync(query, { schema });
```

The async path awaits validators sequentially in filter-tree order. Calling a synchronous method when a validator returns a Promise/thenable throws a `SchemaError` with `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER`. Compound `and`/`or` structure is preserved; if every submitted leaf is rejected, the schema default is applied.

## Regex trust model

The `regex` operator's pattern is **passed through to the consuming engine** — rapiq does not analyze, rewrite or sandbox it:

- [`@rapiq/sql`](/packages/sql) and [`@rapiq/typeorm`](/packages/typeorm) hand the pattern to the database engine to interpret and validate — the engine's own syntax checks, limits and timeouts govern it.
- [`@rapiq/memory`](/packages/memory) compiles the pattern with JavaScript's backtracking `RegExp` engine and evaluates it against every record — a crafted pattern (nested quantifiers such as `(a+)+$`) over long field values can burn CPU (ReDoS). Compilation rejects invalid syntax, not pathological patterns.

Whether a hostile pattern can reach an evaluator depends on the input dialect:

- The **URL dialects cannot carry one** — `regex` has no wire spelling, so queries decoded by [`@rapiq/codec-url`](/packages/codec-url) never contain a regex condition.
- The **[MongoDB-style parser](/packages/parser-mongo) accepts `$regex`** (a pattern string or `RegExp`) from client documents.

::: warning Gate `$regex` for untrusted clients
An application that parses untrusted mongo-style filter documents and evaluates them in-process with `@rapiq/memory` must gate the operator — the `allowed` list does not help, since `$regex` applies to allowed fields.
:::

The [`validate` hook](#schema-options) sees every parsed leaf and can reject regex conditions:

```typescript
import { FilterFieldOperator, defineSchema } from '@rapiq/core';

const schema = defineSchema<User>({
    filters: {
        allowed: ['id', 'name'],
        validate: (filter) => {
            // reject client-submitted regex conditions
            if (filter.operator === FilterFieldOperator.REGEX) {
                return undefined;
            }

            return filter;
        },
    },
});
```

A leaf rejected by `validate` is silently dropped, independent of the `throwOnFailure` policy — throw from the hook to turn a client-submitted regex into an error response instead. Softer gates work the same way: cap the pattern's source length or match it against a vetted list, and return the filter when it passes.

## On violation

Legacy simple and MongoDB field-key failures follow the schema's drop-vs-throw policy. Expression filters are precise: syntax and schema-key violations throw `FiltersParseError`. See [Error Handling](/guide/errors).

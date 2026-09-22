# Filters

Narrow the collection by conditions on fields: from a simple equality to arbitrary `and`/`or` trees.

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
| `REGEX` | pattern | `$regex` | `regex` | (none) |
| `MOD` | divisible remainder | `$mod` | `mod` | (none) |
| `SIZE` | array length | `$size` | `size` | (none) |
| `EXISTS` | is not null | `$exists` | `exists` | (none) |
| `ELEM_MATCH` | array element match | `$elemMatch` | `elemMatch` | (none) |

`REGEX`, `MOD` and `EXISTS` have no representation in the URL dialects; they work in code and via the [MongoDB-style parser](/packages/parser-mongo). `ELEM_MATCH` and `SIZE` travel in the [expression dialect](/packages/parser-expression) only.

Backend support varies per [adapter](/guide/executing-queries). `EXISTS` works everywhere. `REGEX` and `MOD` evaluate in [`@rapiq/adapter-memory`](/packages/adapter-memory) and render through [`@rapiq/adapter-sql`](/packages/adapter-sql) / [`@rapiq/adapter-typeorm`](/packages/adapter-typeorm), each gated by a per-dialect callback (`regex` needs a regex-capable dialect, so the mssql and sqlite presets throw a typed error instead; `mod` needs a modulo spelling, which every shipped preset has, pg/mysql/sqlite/oracle via `MOD()` and mssql via the `%` operator, with [one caveat for SQLite builds](/packages/adapter-sql#dialects)). [`@rapiq/adapter-prisma`](/packages/adapter-prisma) and [`@rapiq/adapter-drizzle`](/packages/adapter-drizzle) raise a typed `AdapterError` (`FEATURE_UNSUPPORTED`) for `regex`, `mod`, `size`, the `ITSELF` marker and `elemMatch` on a to-one relation instead of approximating; see the limitations section of each package page. Before accepting `regex` from untrusted input, read the [trust model](#regex-trust-model) below.

`SIZE` matches arrays with exactly the given number of elements (a non-negative integer); missing or non-array values never match, and there is no negated leaf twin (`not(size(…))` stays a [negated group](#negation)). It evaluates in [`@rapiq/adapter-memory`](/packages/adapter-memory) only: the SQL adapters throw a typed `featureUnsupported` until dialect-level JSON-array support lands, and the prisma/drizzle serializers have no array-length filter to target.

Inside an `elemMatch` interior, the reserved `ITSELF` marker (wire spelling `$this`) may take the field position of a condition to address the array element itself: `elemMatch('scores', gt(ITSELF, 5))` matches when some score is greater than five. `@rapiq/adapter-memory` evaluates it element-wise; every other adapter throws a typed `featureUnsupported` (for the SQL adapters a joined relation row is not a scalar column, and prisma/drizzle cannot address the element itself). Anywhere outside an `elemMatch` interior the marker is a typed error.

## On the wire (expression dialect)

The URL codec writes one expression by default, preserving compound structure and repeated fields:

```txt
codec=url-expression&filter=and(gte(age,'18'),or(eq(status,'active'),eq(status,'pending')))
```

Most function names match the condition helpers in the table above; `in` keeps its wire spelling (`inArray` is only the code helper name). The negated leaf operators are the exception: `nin` has its own keyword, but `ne`, `notContains`, `notStartsWith` and `notEndsWith` are not expression keywords. On the wire they are spelled `not(...)` around the positive form, e.g. `not(eq(name,'John'))` for `ne`; decoding normalizes such a single twin-able leaf back to its negated twin (see [Negation](#negation)). Values are single-quoted; quote characters escape by doubling (`'it''s'`).

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

The v2 codec continues to decode this shape for existing clients. Multiple keys combine with **and**. Scalar coercion applies on decode: `'18'` → `18`, `'true'` → `true`, `'null'` → `null`. The deprecated simple codec rejects duplicate same-field conditions and compound filters; use the default expression codec whenever a query needs either shape.

::: info Wire strings vs. code
The `!`/`<`/`~` prefixes are the *wire* format. In code, use typed operator objects (`{ age: { $gte: 18 } }`) or condition helpers, never magic strings.
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

- **in code**: condition helpers `or(...)`, `and(...)`, `not(...)`, arbitrarily nested;
- **over a URL**: the [expression codec](/packages/codec-url#expression-dialect), `filter=or(gte(age,'18'),eq(status,'active'))`;
- **in a request body**: the [MongoDB-style parser](/packages/parser-mongo), `{ $or: [...] }`.

### Negation

`not(condition)` matches exactly the records its interior does **not** match, the
[complement law](#null-semantics) extended from the negated leaf operators to arbitrary trees:

```typescript
import { and, defineQuery, eq, gt, not } from '@rapiq/core';

defineQuery<User>({
    filters: not(and(eq('status', 'active'), gt('age', 65))),
});
```

Where a negated leaf operator exists, `not` is the same condition (`not(eq(…))` ≡ `ne(…)`);
its value is negating conditions **without** a negated twin: ordering comparisons
(`not(gt(…))`), `size`, `elemMatch` and whole groups. Multiple arguments negate their
conjunction: `not(a, b)` ≡ `not(and(a, b))`.

On the wire, the expression dialect carries it as `filter=not(gt(age,'65'))`; the legacy
simple dialect cannot express it (encoding throws a typed error). SQL adapters render the
negation **null-inclusively** (a `CASE` wrapper collapses SQL's three-valued `UNKNOWN` to
false), so a record with `age = NULL` matches `not(gt('age', 65))` on every backend, the
same verdict `@rapiq/adapter-memory` produces.

## Nested fields

`relation.field` keys filter on related records. The relation must be permitted and requested via [relations](/guide/relations), and the field validates against the related schema through [`schemaMapping`](/guide/schemas#the-registry-relations).

## Null semantics

`null` is a first-class filter value with SQL-consistent behavior across all adapters:

| Filter | Meaning |
|---|---|
| `eq(field, null)` | `field IS NULL` |
| `ne(field, null)` | `field IS NOT NULL` |
| `inArray(field, [a, null])` | `field IN (…) OR field IS NULL` |
| `exists(field)` | `field IS NOT NULL` |

Negated operators (`ne`, `nin`, `notContains`, `notStartsWith`, `notEndsWith`) are **exact complements** of their positive twins: for values that don't name `null` themselves, they also match records where the field is `NULL`/absent, e.g. `ne(field, a)` → `(field <> ? OR field IS NULL)`. When the negated value does name `null`, the complement excludes those records instead: `nin(field, [a, null])` matches neither `a` nor `NULL`/absent, precisely because `inArray(field, [a, null])` matches both.

The same complement law governs [`not(...)`](#negation) over whole trees: `not(c)` selects exactly the records `c` does not, on every backend.

## Date values

The wire is untyped: a date crosses it as a string (`filter[created_at]=>=2026-08-23T00:00:00.000Z`), never as a `Date`. Each adapter reads that operand back into the form its backend compares against, so a date column can join a `filters.allowed` list and a time window is an ordinary range filter:

| Adapter | Binds |
|---|---|
| `@rapiq/adapter-typeorm` | the column's own storage literal: a UTC wall-clock string for a zone-less `datetime`/`timestamp` column, the ISO instant for a `timestamptz`, `YYYY-MM-DD` for a `date` |
| `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle` | a `Date` instance |
| `@rapiq/adapter-memory` | reads the string as an instant whenever the record value is a `Date` |

Accepted operand forms are an ISO-8601 date (`2026-08-23`) or date-time (`2026-08-23T10:16:44.000Z`, a space in place of the `T` is fine too), an epoch timestamp in milliseconds, and a `Date`. The grammar is matched explicitly rather than handed to `new Date()`, which accepts implementation-defined forms (`August 23, 2026` parses, `2026` silently means January 1st) and rolls a day the calendar does not have into the next month, so `2026-02-30` would quietly select March 2nd. A date-time carrying no offset is read as UTC, not in the server's zone, so one query selects the same rows on every machine.

A value that denotes no instant (`filter[created_at]=yesterday`, `2026-02-30`) is refused with an `AdapterError` carrying `ErrorCode.KEY_VALUE_INVALID` instead of reaching the driver, which answers a malformed client value with a server error. Only the bindings that *know* the field is temporal can refuse: `@rapiq/adapter-typeorm` on a date column, and `@rapiq/adapter-prisma`/`@rapiq/adapter-drizzle` on a field their metadata marks as a date. `@rapiq/adapter-memory` has no such declaration and simply leaves the value unequal and incomparable, and `@rapiq/adapter-sql`'s default `bindValue` passes every operand through untouched.

::: warning Zone-less columns are read as UTC
A `datetime`/`timestamp` column stores no offset, so the operand has to be spelled in the same zone the value was written in, and rapiq spells it in UTC.

Binding a `Date` instead is not an alternative: the Postgres and MySQL drivers serialize one in the **host's** local zone, and a zone-less column discards the offset marker, so the same query would select different rows on different machines.

The consequence is worth knowing: TypeORM's SQLite driver writes such a column in UTC unconditionally, but its Postgres and MySQL drivers hand the driver a `Date`, so on a host whose clock is not UTC they write **local** wall clock. Run the application (or the connection) in UTC, which is what a server normally does, or use a zone-aware column type (`timestamptz`). Rows written by a database default such as `now()` are unaffected.
:::

Which fields are temporal comes from the adapter's own knowledge of the backend: TypeORM reads the entity metadata, `@rapiq/adapter-prisma` and `@rapiq/adapter-drizzle` ask their `metadata` (a `DateTime` field, or a column whose `dataType` is `date`), and `@rapiq/adapter-memory` sees the record value itself. `@rapiq/adapter-sql` emits placeholders and leaves binding to the caller, so it binds operands unchanged; override `bindValue(field, value)` on its filters adapter to hook in a column-type table of your own.

Only equality and ordering operands are read this way. A `contains`/`startsWith` pattern or a `mod` divisor is not a value of the column's domain and passes through untouched.

## Case sensitivity

String matching is **case-insensitive by default**, uniformly across every adapter: the same query matches the same records whether it runs on Postgres, MySQL, in memory, or through TypeORM:

- The **equality family** (`eq`, `ne`, `in`, `nin`) compares string values case-insensitively: `eq('name', 'super hero')` matches `Super Hero`. Non-string values (numbers, booleans, dates, `null`) are unaffected.
- The **anchored operators** (`contains`, `startsWith`, `endsWith` and their negations) match case-insensitively as well, and honour the same opt-out.
- **Range comparisons** (`lt`/`lte`/`gt`/`gte`) and `sorts` follow the backend's collation; rapiq does not fold string ordering.

Opt out per field with the `caseSensitive` schema option where exactness matters (identifiers, tokens, enum-like codes):

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
// @rapiq/adapter-sql & @rapiq/adapter-typeorm
adapter.execute(query, { caseSensitive: schema.filters.caseSensitive });

// @rapiq/adapter-memory
applyQuery(query, data, { caseSensitive: schema.filters.caseSensitive });
```

The key is the same on every backend: `@rapiq/adapter-prisma` and `@rapiq/adapter-drizzle` accept `caseSensitive` in their constructor options, and their `execute()` options take a per-call override of the adapter-level setting.

Passing `caseSensitive: true` instead of a list opts **every** field out of the fold at once: for condition trees whose field keys aren't known upfront, e.g. caller-supplied authorization policies. The collation caveat below applies unchanged: on the MySQL/MSSQL presets matching delegates to the column collation either way, so a `*_ci` collated column still matches case-insensitively.

Under the hood, `@rapiq/adapter-sql` folds both sides of the comparison: `lower(field) = lower(?)` for equality (only when the filter value is a string), and `lower(field) like lower(?) escape '!'` for the anchored operators, which render as `LIKE` on every dialect and stringify their value first. Dialects that already compare case-insensitively skip the fold, so plain indexes stay usable: MySQL and MSSQL for both families (their default `*_ci` collations), and SQLite for `LIKE` only (its `LIKE` is ASCII-case-insensitive, its `=` is not).

On folding dialects, index the shape you actually emit. On Postgres the two families need different indexes, because an operator class that serves `=` does not serve a prefix `LIKE` under a non-`C` collation:

```sql
-- serves lower(name) = lower($1)          (eq / ne / in / nin)
CREATE INDEX ON "user" (lower(name));
-- serves lower(path) LIKE lower($1)       (startsWith, folded)
CREATE INDEX ON "user" (lower(path) text_pattern_ops);
-- serves path LIKE $1                     (startsWith, path listed in caseSensitive)
CREATE INDEX ON "user" (path text_pattern_ops);
```

Measured on Postgres 18.4: a default `en_US.utf8` btree serves none of the `LIKE` forms, and only `startsWith` can use a btree at all. For `contains` and `endsWith` on Postgres, index the folded expression with trigrams:

```sql
CREATE INDEX ON "user" USING gin (lower(name) gin_trgm_ops);
```

A `gin (name gin_trgm_ops)` index without the `lower()` does not serve the folded comparison, so a column that relied on one for `contains` needs the index recreated or the column listed in `caseSensitive`.

The TypeORM adapter goes one step further: it resolves each filtered field against the entity metadata and folds **only string-typed columns**. Numeric, date, uuid or enum columns never pay the `lower()` cost, even when the value arrives as an untyped wire string like `filter[age]=18`.

::: warning Collation wins on MySQL/MSSQL, and on SQLite for `LIKE`
On the MySQL/MSSQL presets, matching delegates to the column collation: `caseSensitive` cannot force exactness onto a `*_ci` collated column. The same holds for the anchored operators on SQLite, whose `LIKE` is ASCII-case-insensitive whatever the option says (its `=`, and therefore the equality family, does honour the opt-out). Use a `*_bin`/`*_cs` collation for such columns, or override `caseFold` with a `lower()`-wrapping implementation (`caseFoldLike`, which governs the `LIKE` comparisons, inherits it unless the dialect sets its own).

MySQL's default `utf8mb4_0900_ai_ci` also folds **accents** for `LIKE`: `'APFEL' LIKE 'ä%'` is `1`. So `startsWith('name', 'ä')` matches `APFEL` on MySQL, and does not on Postgres. A `*_as_cs` collation is the fix where that matters.

Where an engine ignores the opt-out, `@rapiq/adapter-memory` does not, so an opted-out anchored filter can return different records in memory than on MySQL or SQLite. Note also that folding a `character(n)` column on Postgres drops its padding, so an `endsWith` on a blank-padded column matches where the unfolded comparison does not.
:::

## Schema options

```typescript
defineSchema<User>({
    filters: {
        allowed: ['id', 'name', 'age'],
        mapping: { aliasId: 'id' },
        default: eq('status', 'active'),
        // accept (return the filter), replace (return any condition,
        // including a compound), or reject (return undefined); a hook
        // that returns nothing rejects every filter.
        validate: async (filter) => filter,
    },
});
```

| Option | Description |
|---|---|
| `allowed` | Filterable field names. Omit to allow all; `[]` blocks the parameter. |
| `default` | Condition applied when the client sends no filters. |
| `mapping` | Alias → field translation applied before validation. |
| `validate` | Sync or async per-filter hook: inspect a parsed `Filter`, replace it with any condition, or reject it. Receives the [parse context](/guide/schemas#validate-hooks-parse-context) as its second argument. |
| `caseSensitive` | Fields whose equality comparisons stay exact instead of the [case-insensitive default](#case-sensitivity). |
| `indexed` | Check the parsed tree against the schema `indexes` declaration: `'anchor'` (or `true`) requires one index-leading conjunct per AND group, `'cover'` full prefix coverage. See [Indexes](/guide/schemas#indexes). |

`validate` runs after key resolution, mapping and value coercion, and receives the caller-supplied [`context`](/guide/schemas#validate-hooks-parse-context) (e.g. the authenticated actor) as its second argument. Return the original filter to accept it, another condition to replace it, or `undefined` to reject that leaf; an inspect-only hook must still `return` the filter, otherwise every leaf is rejected. The replacement may be any condition, including a compound: an authorization decision like "you may filter on `realm_id`, but only within your realms" stays attached to the leaf that triggered it, `and(filter, preserve(inArray('realm_id', actor.realmIds)))`, instead of being injected separately after the parse. `$elemMatch` conditions are validated inside-out: every interior leaf passes the hook, then the `elemMatch` filter itself. The return value may also be a Promise of any of those results. On the server, [schema-aware encoding](/packages/codec-url) re-runs the schema-bound decoder, so a validator that is not idempotent (e.g. one that appends to the value) transforms a filter twice between a schema-aware `encode()` and the receiving `decode()`: keep validators idempotent.

All filter composition is ordered logical AND, so a later merge carries the complete replacement as a conjunct and never removes it. The deprecated simple URL dialect cannot express compounds: schema-aware encoding through it throws `FEATURE_UNSUPPORTED` for a query whose validator produced one; the default expression dialect encodes it.

Preserve the **residual**, not the whole group. `preserve(and(filter, ...))` also keeps the client leaf from being pruned by a rejected relation. With `and(filter, preserve(...))`, the client leaf prunes normally and only a residual that itself needs a rejected relation raises `SchemaError` (`ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED`). That is the genuine validator contradiction. `preserve()` exists for this relation-pruning policy, not filter composition.

Use the synchronous `parse()` / `decode()` / schema-aware `encode()` methods when every validator is synchronous. Use their `Async` counterparts when a validator may be asynchronous:

```typescript
const query = await parser.parseAsync(input, { schema });
const decoded = await codec.decodeAsync(req.query, { schema });
const encoded = await codec.encodeAsync(query, { schema });
```

The async path awaits validators sequentially in filter-tree order. Calling a synchronous method when a validator returns a Promise/thenable throws a `SchemaError` with `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER`. Compound `and`/`or` structure is preserved; if every submitted leaf is rejected, the schema default is applied.

## Regex trust model

The `regex` operator's pattern is **passed through to the consuming engine**; rapiq does not analyze, rewrite or sandbox it:

- [`@rapiq/adapter-sql`](/packages/adapter-sql) and [`@rapiq/adapter-typeorm`](/packages/adapter-typeorm) hand the pattern to the database engine to interpret and validate: the engine's own syntax checks, limits and timeouts govern it.
- [`@rapiq/adapter-memory`](/packages/adapter-memory) compiles the pattern with JavaScript's backtracking `RegExp` engine and evaluates it against every record; a crafted pattern (nested quantifiers such as `(a+)+$`) over long field values can burn CPU (ReDoS). Compilation rejects invalid syntax, not pathological patterns.

Whether a hostile pattern can reach an evaluator depends on the input dialect:

- The **URL dialects cannot carry one**: `regex` has no wire spelling, so queries decoded by [`@rapiq/codec-url`](/packages/codec-url) never contain a regex condition.
- The **[MongoDB-style parser](/packages/parser-mongo) accepts `$regex`** (a pattern string or `RegExp`) from client documents.

::: warning Gate `$regex` for untrusted clients
An application that parses untrusted mongo-style filter documents and evaluates them in-process with `@rapiq/adapter-memory` must gate the operator; the `allowed` list does not help, since `$regex` applies to allowed fields.
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

A leaf rejected by `validate` follows the same drop-vs-throw policy as every other rejection: it is dropped by default, and raises `KEY_VALIDATE_REJECTED` under [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw), where it appears in the [trace](/guide/errors#issue-traces) the error carries. A dropped leaf is not reported: the raised error is the only channel. To drop a leaf quietly under a throwing schema, return a replacement condition instead of `undefined`. Softer gates work the same way: cap the pattern's source length or match it against a vetted list, and return the filter when it passes.

## On violation

Legacy simple and MongoDB field-key failures follow the schema's drop-vs-throw policy. Expression filters are precise: syntax and schema-key violations always fail the parse, recorded on the [issue trace](/guide/errors#issue-traces) of the raised `inputRejected` error. See [Error Handling](/guide/errors).

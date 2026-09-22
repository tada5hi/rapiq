# @rapiq/adapter-sql

Turns query AST nodes into **parameterized SQL fragments**. Database-agnostic: per-database behavior is injected as a small dialect option object, not a subclass. It is also the foundation the [TypeORM adapter](/packages/adapter-typeorm) builds on.

```sh
npm install @rapiq/core @rapiq/adapter-sql
```

## Dialects

A dialect is a handful of callbacks:

```typescript
type DialectOptions = {
    escapeField: (input: string) => string,      // mysql: `field`, pg: "field", mssql: [field]
    paramPlaceholder: (index: number) => string, // pg: $1, mysql: ?
    regexp?: (field: string, placeholder: string, ignoreCase: boolean) => string,
    caseFold?: (input: string) => string,        // default: lower(input); mysql/mssql: identity
    caseFoldLike?: (input: string) => string,    // default: caseFold; sqlite: identity
    mod?: (field: string, divisorPlaceholder: string, remainderPlaceholder: string) => string,
    // default: mod(field, divisor) = remainder; mssql: field % divisor = remainder
};
```

Presets ship for `pg`, `mysql`, `sqlite`, `mssql` and `oracle`:

```typescript
import { mysql, pg } from '@rapiq/adapter-sql';
```

`resolveDialect(name)` maps a driver/connection type name (e.g. TypeORM's `connection.options.type` or a knex client name) to the matching preset (`postgres`, `mariadb`, `better-sqlite3`, `oracledb`, …) and returns `undefined` for unknown names:

```typescript
import { resolveDialect } from '@rapiq/adapter-sql';

resolveDialect('mariadb'); // mysql preset
```

::: warning Dialects without regex support
The `mssql` and `sqlite` presets omit the `regexp` callback: SQL Server has no regex operator, and stock SQLite ships without a `REGEXP` function. The callback serves the `regex` filter operator **only**, so on those two presets that operator throws a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`) and nothing else is affected. The `contains` / `startsWith` / `endsWith` operators render as `LIKE` on every preset, regex-capable or not (see [String matching](#string-matching)).
:::

No single `mod` spelling works everywhere: `pg`, `mysql`, `sqlite` and `oracle` render `mod(field, divisor) = remainder` (a `MOD()` function or equivalent); `mssql` has no `MOD()` function, so its preset renders `field % divisor = remainder` instead, using SQL Server's modulo operator. A custom dialect that omits the `mod` callback raises a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`, feature `filters:mod`) for the `mod` filter operator, exactly like an omitted `regexp`.

::: warning SQLite needs a build with math functions
SQLite's `mod()` is a [math function](https://sqlite.org/lang_mathfunc.html): available since SQLite 3.35, and only in builds compiled with `SQLITE_ENABLE_MATH_FUNCTIONS`. Every mainstream Node driver enables it (`better-sqlite3`, `node:sqlite`, `sqlite3`), so the preset renders `mod(...)`; a build without it reports `no such function: mod`. Some embedded targets the preset also covers (`sql.js`, `cordova`, `react-native`, `capacitor`, `expo`, `nativescript`) make no such guarantee, so override the callback there:

```typescript
import { sqlite } from '@rapiq/adapter-sql';

const dialect = {
    ...sqlite,
    // `%` is core syntax and always available, but SQLite casts both
    // operands to INTEGER: `5.5 % 2` is 1, whereas `mod(5.5, 2)` is 1.5.
    // Only equivalent for integer operands.
    mod: (field: string, divisor: string, remainder: string) => `${field} % ${divisor} = ${remainder}`,
};
```

Setting `mod: undefined` instead turns the operator into the typed `filters:mod` refusal, which is the safer choice when non-integer operands are possible: `@rapiq/adapter-memory` evaluates `mod` with JavaScript's `%` (float-capable), so an integer-casting `%` would answer differently for the same query.
:::

## The root adapter

Each parameter has an adapter/visitor pair (`FieldsAdapter`/`FieldsVisitor`, `SortsAdapter`/`SortsVisitor`, `PaginationAdapter`/`PaginationVisitor`, `RelationsAdapter`/`RelationsVisitor`) that collects the walked state: selected columns, order map, limit/offset, relation paths. A root `Adapter` bundles all five; `execute(query)` walks a whole `Query` into it and returns the accumulated clause fragments:

```typescript
import { Adapter, pg } from '@rapiq/adapter-sql';

const adapter = new Adapter({ ...pg, rootAlias: 'user' });

const fragments = adapter.execute(query);
// {
//     columns: ['"user"."id"', '"user"."name"', '"r5_realm"."name"'],
//     where: '("user"."age" >= $1 and ...)',
//     params: [18, ...],
//     orderBy: ['"user"."age" DESC'],
//     limit: 25,
//     offset: 50,
//     relations: ['realm'],   // canonical paths, parents included
// }
```

Construct the `Adapter` **per request**: it accumulates per-call state; the shareable, long-lived part is the options object.

`@rapiq/adapter-sql` deliberately stops at fragments: composing the final `SELECT` statement (in particular `FROM`/`JOIN` conditions, which require knowledge of the table layout) is the job of the caller or a backend adapter. That's exactly what [`@rapiq/adapter-typeorm`](/packages/adapter-typeorm) does for TypeORM.

::: warning Alias convention
Fragments reference joined columns through the exported `buildRelationAlias(path)` derivation. It length-prefixes every path segment (`realm` → `r5_realm`, `role.realm` → `r4_role_5_realm`), so `role_realm` and `role.realm` cannot collapse onto one alias. Use the same helper when rendering `JOIN` clauses from `relations`, or inject one convention through the `relationAlias` adapter option. Keep a custom derivation collision-free and within your database's identifier length limit.
:::

### Dotted paths & relations

A dotted field path (`realm.name`) references a joined relation by default: the prefix registers with the relations adapter and the fragment renders against the derived join alias. Backends where a dotted prefix is not necessarily a relation override `isRelationPath(path)` on the relations adapter (default: `true`); segments only count as a relation path while the hook confirms them, and the remainder stays part of the column name, rendered against the parent alias (the root alias, or the last confirmed relation's join alias). The [TypeORM adapter](/packages/adapter-typeorm) implements the hook via entity metadata so [embedded column paths](/packages/adapter-typeorm#embedded-columns) such as `profile.firstName` don't produce a bogus join.

## Rendering filters standalone

The filters adapter accumulates conditions while a visitor walks the tree, then hands back SQL plus bound parameters:

```typescript
import {
    FiltersAdapter, FiltersVisitor, RelationsAdapter, pg,
} from '@rapiq/adapter-sql';

const filters = new FiltersAdapter(new RelationsAdapter(), pg);

query.filters.accept(new FiltersVisitor(filters));

const [sql, params] = filters.getQueryAndParameters();
// sql:    (lower("name") like lower($1) escape '!' and "age" >= $2)
// params: ['%jo%', 18]
```

Values are always bound as parameters, never interpolated into the SQL string.

This package emits fragments and leaves the binding to the caller, so operands pass through as they arrived. Override `bindValue(field, value)` on the filters adapter to prepare an operand for the column it addresses: it receives every equality and ordering operand (patterns and modulo operands are not values of the column's domain and skip it). [@rapiq/adapter-typeorm](/packages/adapter-typeorm#date-columns) overrides it to bind [date values](/guide/filters#date-values) in their column's storage form.

### Null semantics

A `null` filter value is rewritten to the SQL null predicates instead of being bound as a parameter (which would match nothing):

| Filter | SQL |
|---|---|
| `eq(field, null)` | `field IS NULL` |
| `ne(field, null)` | `field IS NOT NULL` |
| `in(field, [a, null])` | `(field IN (...) OR field IS NULL)` |
| `nin(field, [a, null])` | `(field NOT IN (...) AND field IS NOT NULL)` |

An empty list never matches: `in(field, [])` renders `1 = 0` and `nin(field, [])` renders `1 = 1` (instead of the invalid `IN ()`).

Negated operators are **exact complements** of their positive twins: a record that does not match `eq(field, a)` matches `ne(field, a)`, including records where the column is `NULL`. Since a bare SQL negation drops `NULL` rows under three-valued logic, negations render null-inclusively:

| Filter | SQL |
|---|---|
| `ne(field, a)` | `(field <> ? OR field IS NULL)` |
| `nin(field, [a, b])` | `(field NOT IN (...) OR field IS NULL)` |
| `notContains(field, a)` (also `notStartsWith` / `notEndsWith`) | `(field NOT LIKE ? ESCAPE '!' OR field IS NULL)` |

### String matching

The `contains` / `startsWith` / `endsWith` operators (and their negations) render as `LIKE` on **every** dialect, with the value escaped and wrapped into the matching pattern:

| Filter | Pattern | SQL (pg) |
|---|---|---|
| `startsWith(field, 'foo')` | `foo%` | `lower("field") like lower($1) escape '!'` |
| `endsWith(field, 'foo')` | `%foo` | `lower("field") like lower($1) escape '!'` |
| `contains(field, 'foo')` | `%foo%` | `lower("field") like lower($1) escape '!'` |
| `notContains(field, 'foo')` | `%foo%` | `(lower("field") not like lower($1) escape '!' or "field" is null)` |

Previously the regex-capable presets built an anchored regular expression instead (`field ~* '^foo'`). `LIKE` replaced it because a regex predicate can cost an index: measured on MySQL 9.7.1 over 50k rows with a btree index, `col regexp '^sales/' = 1` examined all 50,000 rows (a covering index scan) where `col like 'sales/%'` examined 50 (a range scan). On Postgres 18.4 the two are equivalent (`col ~ '^sales/'` and `col like 'sales/%'` produce the identical Index Cond on a `text_pattern_ops` index), so nothing is lost there either. `LIKE` is also what every other backend adapter emits, so the rendering is uniform now. The `regexp` dialect callback stays reserved for the `regex` operator alone.

The fold is not free either: `lower()` copies the whole column value per row, where the regex could stop at the anchor, so an unindexed `startsWith` over a wide text column is measurably slower folded than it was as a regex. List such a column in `caseSensitive` when exactness is acceptable.

Only `startsWith` can win a **btree** index that way: `contains` (`%foo%`) and `endsWith` (`%foo`) cannot use one, exactly as they could not under a regex.

::: warning Postgres trigram indexes
`pg_trgm` is the exception, and the one configuration this change makes slower. A `gin (col gin_trgm_ops)` index serves `col ~* '?'` and `col LIKE '%?%'`, but not `lower(col) LIKE lower('%?%')`: measured on Postgres 18.4 over 100k rows, `contains` went from a 0.9 ms bitmap index scan to a 22 ms sequential scan. Index the folded expression instead, `CREATE INDEX ON "user" USING gin (lower(path) gin_trgm_ops)`, or list the column in `caseSensitive`.
:::

The value is matched **literally**: `%`, `_` and the escape character itself are escaped into the pattern, so `contains(field, '100%')` binds `'%100!%%'` and matches the literal percent sign. `[` is escaped on the `mssql` preset only, where it opens a character range (`likeBracketWildcard`); escaping it elsewhere would make Oracle raise ORA-01424, since Oracle accepts an escape character only before `%`, `_` or itself. Only the `regex` operator interprets its `RegExp` or string value as a pattern. A JavaScript `RegExp` contributes its `source` and `ignoreCase` flag; a string is passed through unchanged so the selected database regex engine owns its syntax and validation.

The negations match rows whose column is `NULL` (complement law, see above).

::: warning The escape character is `!`, not a backslash
Every emitted `LIKE` carries `ESCAPE '!'` (exported as `LIKE_ESCAPE_CHARACTER`). A backslash cannot be spelled statically: MySQL rejects `escape '\'` as a syntax error (ERROR 1064) under the default `sql_mode`, and rejects `escape '\\'` under `NO_BACKSLASH_ESCAPES`, so no single backslash spelling parses on both. `!` is never a `LIKE` metacharacter and was measured equivalent on Postgres, MySQL (both `sql_mode`s) and SQLite.
:::

### Case sensitivity

String equality (`eq` / `ne` / `in` / `nin`) and the anchored operators (`contains` / `startsWith` / `endsWith` and their negations) match [case-insensitively by default](/guide/filters#case-sensitivity). On dialects whose comparison is case-sensitive, both sides fold through a dialect callback: `caseFold` for equality, `caseFoldLike` for the `LIKE` comparisons.

| Filter | pg / oracle | sqlite | mysql / mssql |
|---|---|---|---|
| `eq(field, 'a')` | `lower(field) = lower(?)` | `lower(field) = lower(?)` | `field = ?` |
| `in(field, ['a', 1])` | `lower(field) IN (lower(?), ?)` | `lower(field) IN (lower(?), ?)` | `field IN (?, ?)` |
| `startsWith(field, 'a')` | `lower(field) LIKE lower(?) ESCAPE '!'` | `field LIKE ? ESCAPE '!'` | `field LIKE ? ESCAPE '!'` |

The `mysql` and `mssql` presets set `caseFold` to identity: their default collations (`*_ci`) already compare case-insensitively, and skipping `lower()` keeps plain indexes usable. The `sqlite` preset goes one step finer and sets only `caseFoldLike` to identity, because SQLite's `LIKE` is already ASCII-case-insensitive while its `=` is not: folding the `LIKE` would buy nothing semantically (`lower()` is ASCII-only there too) and would cost the prefix optimisation, which needs an index whose collation matches the comparison (`NOCASE` under the default `case_sensitive_like`). `caseFoldLike` defaults to `caseFold` when a dialect omits it.

Fields opted out via the top-level `caseSensitive` execute option render unfolded on every dialect, for both folds (`true` opts every field out). Where the dialect skips a fold anyway, the opt-out has nothing left to switch off: on MySQL and MSSQL for both families, and on SQLite for the anchored operators, matching stays collation-governed.

```typescript
adapter.execute(query, { caseSensitive: ['id'] });
```

::: tip Indexing folded columns on Postgres
The two families need different indexes, because an operator class that serves `=` does not serve a prefix `LIKE` under a non-`C` collation:

```sql
-- serves lower(name) = lower($1)
CREATE INDEX ON "user" (lower(name));
-- serves lower(path) LIKE lower($1) with a literal prefix
CREATE INDEX ON "user" (lower(path) text_pattern_ops);
-- serves path LIKE $1 when the column is listed in caseSensitive
CREATE INDEX ON "user" (path text_pattern_ops);
```

Measured on Postgres 18.4: a default `en_US.utf8` btree serves none of these forms, and the case-insensitive spellings the adapter does *not* emit (`col ~* '^sales/'`, `col ILIKE 'sales/%'`) both produced a Seq Scan, which is why the fold is expressed as `lower(...)` on both sides instead. Only `startsWith` gains anything either way: `%foo%` and `%foo` patterns are full scans regardless.
:::

Equality folds only for string filter values; the anchored operators stringify their value first, so their fold is decided by the column alone. Backends with column metadata can exempt whole columns by overriding `isCaseFoldable(field)` on the filters adapter (default: `true`); the [TypeORM adapter](/packages/adapter-typeorm) uses it to fold only string-typed columns, for `LIKE` as well as `=`. A `citext` column is deliberately not folded there: its own operators already compare case-insensitively, and folding would discard its index.

::: warning MySQL folds accents too, and now does so for the anchored operators
Under `utf8mb4_0900_ai_ci` (the MySQL 8+/9 default), `LIKE` is accent-insensitive as well as case-insensitive, while `REGEXP` is neither: `'APFEL' LIKE 'ä%'` is `1`, but `'APFEL' REGEXP '^ä'` is `0`. Rendering the anchored operators as `LIKE` therefore changes MySQL **result sets**, not only query plans: `startsWith('name', 'ä')` now matches `APFEL` there. This is the same behaviour `eq` has always had on MySQL (the preset's `caseFold` is identity for the same collation reason). Use a `*_as_cs` collation on the column when accent and case exactness matter.
:::

### ITSELF (element-level conditions)

The [`ITSELF` marker](/guide/filters#operators) (an `elemMatch` interior condition on the array element itself, produced e.g. by the mongo parser's element-level `$elemMatch` and `$all`) has no SQL rendering: `elemMatch` maps to a relation join, and a joined row is not a scalar column. Both `@rapiq/adapter-sql` and `@rapiq/adapter-typeorm` throw a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`). Dialect-level JSON-array support (`json_each` / `unnest`) may lift this later; evaluate such filters with [`@rapiq/adapter-memory`](/packages/adapter-memory) in the meantime.

### size (array length)

The [`size` operator](/guide/filters#operators) has no SQL rendering either: an array-length check needs per-dialect JSON-array support (`json_array_length` on Postgres/SQLite, `JSON_LENGTH` on MySQL, `cardinality` for Postgres arrays). Both `@rapiq/adapter-sql` and `@rapiq/adapter-typeorm` throw a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`); evaluate such filters with [`@rapiq/adapter-memory`](/packages/adapter-memory) in the meantime.

## Field visibility gates

A schema's `fields` [validate hook](/guide/schemas#condition-verdicts) may gate a column with a condition, meaning *visible only on rows satisfying it*. The rendered SQL cannot express that: a selection stays a bare escaped column, so the column is projected for **every** row and the gate has to be enforced on the fetched rows.

The gate is compiled from the same AST the adapter walks, so the helper that applies it lives in [`@rapiq/adapter-memory`](/packages/adapter-memory), the package that evaluates conditions against plain objects. Install it alongside this one when a schema gates a field:

```typescript
import { applyFieldConditions } from '@rapiq/adapter-memory';

const fragments = adapter.execute(query);
const rows = await driver.query(assemble(fragments));

const output = applyFieldConditions(query.fields, rows);
```

`compileFieldConditions(query.fields)` is the single-record form: it compiles the gates once into a reusable `(record) => redacted` function. Skipping this step fails open: consumers receive the gated column unredacted.

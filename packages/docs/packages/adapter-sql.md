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
The `mssql` and `sqlite` presets omit the `regexp` callback: SQL Server has no regex operator, and stock SQLite ships without a `REGEXP` function. On those dialects the `contains` / `startsWith` / `endsWith` filter operators (and their negations) fall back to `LIKE ... ESCAPE '\'` with wildcard escaping; only the `regex` filter operator is unavailable and throws a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`).
:::

No single `mod` spelling works everywhere: `pg`, `mysql`, `sqlite` and `oracle` render `mod(field, divisor) = remainder` (a `MOD()` function or equivalent); `mssql` has no `MOD()` function, so its preset renders `field % divisor = remainder` instead, using SQL Server's modulo operator. A custom dialect that omits the `mod` callback raises a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`, feature `filters:mod`) for the `mod` filter operator, exactly like an omitted `regexp`.

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
// sql:    ("name" ~* $1 and "age" >= $2)
// params: ['jo', 18]
```

Values are always bound as parameters, never interpolated into the SQL string.

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
| `notContains(field, a)` (also `notStartsWith` / `notEndsWith`) | `(field ~* ? OR field IS NULL)` |

### String matching

The `contains` / `startsWith` / `endsWith` operators (and their negations) match their value **literally** on every dialect: regex metacharacters are escaped on regex-capable dialects, LIKE wildcards are escaped on the LIKE fallback. Only the `regex` operator interprets its `RegExp` or string value as a pattern. A JavaScript `RegExp` contributes its `source` and `ignoreCase` flag; a string is passed through unchanged so the selected database regex engine owns its syntax and validation.

The negations match rows whose column is `NULL` (complement law, see above); on the LIKE fallback they render `(field NOT LIKE ? ESCAPE '\' OR field IS NULL)`.

### Case sensitivity

String equality (`eq` / `ne` / `in` / `nin`) matches [case-insensitively by default](/guide/filters#case-sensitivity). On dialects whose `=` is case-sensitive, both sides fold through the `caseFold` dialect callback, `lower(field) = lower(?)`:

| Filter | pg / sqlite / oracle | mysql / mssql |
|---|---|---|
| `eq(field, 'a')` | `lower(field) = lower(?)` | `field = ?` |
| `in(field, ['a', 1])` | `lower(field) IN (lower(?), ?)` | `field IN (?, ?)` |

The `mysql` and `mssql` presets set `caseFold` to identity: their default collations (`*_ci`) already compare case-insensitively, and skipping `lower()` keeps plain indexes usable. Fields opted out via the top-level `caseSensitive` execute option render unfolded on every dialect (`true` opts every field out):

```typescript
adapter.execute(query, { caseSensitive: ['id'] });
```

On folding dialects, give hot string filter columns an expression index (`CREATE INDEX ... ON "user" (lower(name))`), or opt them out.

Folding only happens for string filter values. Backends with column metadata can exempt whole columns by overriding `isCaseFoldable(field)` on the filters adapter (default: `true`); the [TypeORM adapter](/packages/adapter-typeorm) uses it to fold only string-typed columns.

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

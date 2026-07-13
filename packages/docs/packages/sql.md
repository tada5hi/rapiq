# @rapiq/sql

Turns query AST nodes into **parameterized SQL fragments**. Database-agnostic — per-database behavior is injected as a small dialect option object, not a subclass. It is also the foundation the [TypeORM adapter](/packages/typeorm) builds on.

```sh
npm install @rapiq/core @rapiq/sql
```

## Dialects

A dialect is three callbacks:

```typescript
type DialectOptions = {
    escapeField: (input: string) => string,      // mysql: `field`, pg: "field", mssql: [field]
    paramPlaceholder: (index: number) => string, // pg: $1, mysql: ?
    regexp?: (field: string, placeholder: string, ignoreCase: boolean) => string,
};
```

Presets ship for `pg`, `mysql`, `sqlite`, `mssql` and `oracle`:

```typescript
import { mysql, pg } from '@rapiq/sql';
```

`resolveDialect(name)` maps a driver/connection type name (e.g. TypeORM's `connection.options.type` or a knex client name) to the matching preset — `postgres`, `mariadb`, `better-sqlite3`, `oracledb`, … — and returns `undefined` for unknown names:

```typescript
import { resolveDialect } from '@rapiq/sql';

resolveDialect('mariadb'); // mysql preset
```

::: warning Dialects without regex support
The `mssql` and `sqlite` presets omit the `regexp` callback — SQL Server has no regex operator, and stock SQLite ships without a `REGEXP` function. On those dialects the `contains` / `startsWith` / `endsWith` filter operators (and their negations) fall back to `LIKE ... ESCAPE '\'` with wildcard escaping; only the `regex` filter operator is unavailable and throws a typed `AdapterError` (`ErrorCode.FEATURE_UNSUPPORTED`).
:::

## The root adapter

Each parameter has an adapter/visitor pair (`FieldsAdapter`/`FieldsVisitor`, `SortAdapter`/`SortsVisitor`, `PaginationAdapter`/`PaginationVisitor`, `RelationsAdapter`/`RelationsVisitor`) that collects the walked state — selected columns, order map, limit/offset, relation paths. A root `Adapter` bundles all five; `execute(query)` walks a whole `Query` into it and returns the accumulated clause fragments:

```typescript
import { Adapter, pg } from '@rapiq/sql';

const adapter = new Adapter({ ...pg, rootAlias: 'user' });

const fragments = adapter.execute(query);
// {
//     columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
//     where: '("user"."age" >= $1 and ...)',
//     params: [18, ...],
//     orderBy: ['"user"."age" DESC'],
//     limit: 25,
//     offset: 50,
//     relations: ['realm'],   // canonical paths, parents included
// }
```

Construct the `Adapter` **per request** — it accumulates per-call state; the shareable, long-lived part is the options object.

`@rapiq/sql` deliberately stops at fragments: composing the final `SELECT` statement — in particular `FROM`/`JOIN` conditions, which require knowledge of the table layout — is the job of the caller or a backend adapter. That's exactly what [`@rapiq/typeorm`](/packages/typeorm) does for TypeORM.

## Rendering filters standalone

The filters adapter accumulates conditions while a visitor walks the tree, then hands back SQL plus bound parameters:

```typescript
import {
    FiltersAdapter, FiltersVisitor, RelationsAdapter, pg,
} from '@rapiq/sql';

const filters = new FiltersAdapter(new RelationsAdapter(), pg);

query.filters.accept(new FiltersVisitor(filters));

const [sql, params] = filters.getQueryAndParameters();
// sql:    ("name" ~* $1 and "age" >= $2)
// params: ['jo', 18]
```

Values are always bound as parameters — never interpolated into the SQL string.

### Null semantics

A `null` filter value is rewritten to the SQL null predicates instead of being bound as a parameter (which would match nothing):

| Filter | SQL |
|---|---|
| `eq(field, null)` | `field IS NULL` |
| `ne(field, null)` | `field IS NOT NULL` |
| `in(field, [a, null])` | `(field IN (...) OR field IS NULL)` |
| `nin(field, [a, null])` | `(field NOT IN (...) AND field IS NOT NULL)` |

An empty list never matches: `in(field, [])` renders `1 = 0` and `nin(field, [])` renders `1 = 1` (instead of the invalid `IN ()`).

Negated operators are **exact complements** of their positive twins: a record that does not match `eq(field, a)` matches `ne(field, a)` — including records where the column is `NULL`. Since a bare SQL negation drops `NULL` rows under three-valued logic, negations render null-inclusively:

| Filter | SQL |
|---|---|
| `ne(field, a)` | `(field <> ? OR field IS NULL)` |
| `nin(field, [a, b])` | `(field NOT IN (...) OR field IS NULL)` |
| `notContains(field, a)` (also `notStartsWith` / `notEndsWith`) | `(field ~* ? OR field IS NULL)` |

### String matching

The `contains` / `startsWith` / `endsWith` operators (and their negations) match their value **literally** on every dialect: regex metacharacters are escaped on regex-capable dialects, LIKE wildcards are escaped on the LIKE fallback. Only the `regex` operator interprets its value as a pattern.

The negations match rows whose column is `NULL` (complement law, see above) — on the LIKE fallback they render `(field NOT LIKE ? ESCAPE '\' OR field IS NULL)`.

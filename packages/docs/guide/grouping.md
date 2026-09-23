# Grouping & Aggregates

Turn a collection read into grouped rows: a time series, a breakdown by status, a count per scope. Two
parameters work together: `groups` names the dimensions a row is keyed by, `aggregates` names the
measures computed per row.

| | Groups | Aggregates |
|---|---|---|
| URL key | `group` | `aggregate` |
| AST nodes | `Groups` / `Group { key, name, params, lowering }` | `Aggregates` / `Aggregate { key, name, params, lowering }` |
| Schema options | `allowed`, `functions` | `functions` |
| Built-in functions | `bucket(field, unit)` | `count()`, `count(field)`, `sum(field)` |

A query that carries neither parameter is the same query as before; nothing changes for existing reads.

## On the wire {#on-the-wire}

```txt
group=scope,name                               bare columns
group=bucket(createdAt,day),scope,name         a UTC day bucket plus two columns
aggregate=count                                rows per group (count() is the same)
aggregate=count(couponId),sum(amount)          non-null couponId values, sum of amount
group=scope&group=bucket(createdAt,day)        repeated keys are concatenated
```

A typical dashboard request:

```txt
GET /events?filter[realmId]=<id>&group=bucket(createdAt,day),scope,name&aggregate=count
```

answers rows shaped `{ bucket: '2026-09-22T00:00:00.000Z', scope, name, count: 3 }`.

The grammar is the same in every parser dialect (simple, expression, MongoDB-style):

- a comma separates terms only outside parentheses, so `bucket(createdAt,day),scope` is two terms;
- a term is an identifier, optionally followed by an argument list `name(a,b)`; `count` and `count()` are equal;
- spaces and tabs around identifiers are trimmed: `bucket(createdAt, day)` is accepted;
- an empty term (`a,,b`, a trailing comma), unbalanced or nested parentheses, text after `)`, an
  empty argument (`f(a,)`) and quote characters are grammar errors (`SYNTAX_INVALID`). Quotes are
  reserved for a future time-zone argument.

`encodeURIComponent` escapes the comma and keeps parentheses literal, so a browser-built URL decodes
unchanged.

## Opting in {#opting-in}

Both parameters are **off by default**. A server parses them only when it asks for them, either by listing
them in `parameters` or by flagging them `true`:

```typescript
import { createURLCodec } from '@rapiq/codec-url';

const codec = createURLCodec(registry);

const query = codec.decode(req.query, {
    schema: 'event',
    parameters: ['filters', 'groups', 'aggregates', 'sorts', 'pagination'],
});

// or keep every other parameter and opt in to these two
codec.decode(req.query, { schema: 'event', groups: true, aggregates: true });
```

An endpoint that does not opt in ignores `group=` and `aggregate=` exactly as it ignored any unknown key
before, so upgrading rapiq never turns an entity list into grouped rows behind your back. A `parameters`
list that omits `groups` skips them even when `groups: true` is set, and `groups: false` skips them even when
they are listed. The same options apply to `parser.parse()` / `parseAsync()` on every parser.

## Declaring what may be grouped {#declaring}

A schema lists which columns may be grouped and which functions may be called on which columns:

```typescript
import { defineSchema } from '@rapiq/core';

defineSchema<Event>({
    name: 'event',
    filters: { allowed: ['realmId', 'scope', 'name', 'createdAt'] },
    groups: {
        allowed: ['scope', 'name'],
        functions: { bucket: { allowed: ['createdAt'] } },
    },
    aggregates: {
        functions: { count: {} },
    },
});
```

| Option | Parameter | Description |
|---|---|---|
| `allowed` | `groups` | Root columns a client may group by as bare keys (`group=scope`). |
| `functions.bucket.allowed` | `groups` | Temporal columns `bucket(<column>, hour\|day\|month)` may be called on. |
| `functions.count.allowed` | `aggregates` | Columns `count(<column>)` may be called on. `count()` (row count) is always available once `count` is declared, so `count: {}` permits exactly `count`. |
| `functions.sum.allowed` | `aggregates` | Numeric columns `sum(<column>)` may be called on. |
| `functions.<name>` | both | A [named function](#named-functions) binding one of the built-ins. |

**Grouping is a disclosure surface of its own.** A group by `actorName` enumerates every distinct value of a
column that a reader may otherwise only filter by. The allow-list is therefore declared explicitly per
parameter and never derived from `filters.allowed`.

**Fail-closed.** With a bound schema, a missing `groups` or `aggregates` block permits nothing: every
term is rejected with `KEY_NOT_ALLOWED`. This is the opposite of the other parameters, where an undeclared
allow-list falls back to a syntactic check. `strict` and `throwOnFailure` do not apply to these two
parameters: every rejection fails the parse (see [Errors](#errors)).

**Schemaless parsing** (no `schema` option) accepts the built-in functions and bare columns with a valid
identifier. Named functions need a schema.

Only root columns can be grouped or aggregated: a dotted key (`realm.name`) is rejected with
`KEY_PATH_NOT_ALLOWED`. Bucket units are `hour`, `day` and `month`.

## Named functions {#named-functions}

A schema can also declare a named function that binds a built-in. Every argument slot of the built-in
is either **fixed** by the schema (a scalar) or **open** to the client (an array of permitted values):

```typescript
defineSchema<Order>({
    name: 'order',
    groups: {
        allowed: ['status'],
        functions: {
            // wire: period(hour) or period(day); the column is fixed
            period: { fn: 'bucket', field: 'createdAt', unit: ['hour', 'day'] },
        },
    },
    aggregates: {
        functions: {
            count: { allowed: ['couponId'] },
            // wire: total(amount) or total(fee)
            total: { fn: 'sum', field: ['amount', 'fee'] },
            // wire: revenue; both the function and its column are fixed
            revenue: { fn: 'sum', field: 'amount' },
        },
    },
});
```

The client passes only the open slots, in the built-in's argument order. A named function hides the
column name from the wire (`period(day)` never mentions `createdAt`) and narrows the units or columns
without a separate option. Lowering stays built-in: a named function can only bind `bucket`, `count` or
`sum`, never custom SQL.

Declaration mistakes throw `SchemaError` (`KEY_INVALID`) when the schema is defined: an unknown `fn`, a
missing or unknown slot, an empty open slot, an invalid unit or column name, a built-in key carrying
anything but `allowed`, or a group function named like an allowed column (it would shadow it).

## Output keys {#output-keys}

Every group and aggregate becomes one key of each result row. The key is derived from the wire form
alone, so client and server compute the same key and no `as` syntax is needed:

- a group's key is its name: `scope`, `bucket`, `period`;
- an aggregate's key is its name joined with its arguments by `_`: `count`, `count_couponId`, `sum_amount`.

| Request | Row keys |
|---|---|
| `group=scope,name` | `scope`, `name` |
| `group=bucket(createdAt,day)` | `bucket` |
| `group=period(day)` (named) | `period` |
| `aggregate=count` or `aggregate=count()` | `count` |
| `aggregate=count(couponId)` | `count_couponId` |
| `aggregate=sum(amount),sum(fee)` | `sum_amount`, `sum_fee` |
| `aggregate=total(amount),total(fee)` (named, open column) | `total_amount`, `total_fee` |
| `aggregate=revenue` (named, fixed column) | `revenue` |
| `group=bucket(createdAt,day),bucket(createdAt,hour)` | rejected: `KEY_AMBIGUOUS` |
| `group=count&aggregate=count` | rejected: `KEY_AMBIGUOUS` |
| `aggregate=count,count()` | rejected: `KEY_AMBIGUOUS` |

Groups keep the bare name because two groups with the same callee are two grains of one dimension, a
real collision; declare a named function per grain if a query needs both.

Keys become SQL column aliases, so they are bound by the engine's identifier limit: 63 bytes on PostgreSQL
(a longer alias is truncated), 30 on Oracle before 12.2. `normalizeGroupedRows` (and `normalize`) refuse a
driver row missing an output key with `KEY_VALUE_INVALID` rather than reading it as `null`, so keep column
and function names short enough that `sum_<column>` fits.

## Grouped mode {#grouped-mode}

Once a query carries a group or an aggregate, the other parameters change meaning:

- **Filters** select the rows before they are grouped (`WHERE`). There is no filter on the aggregated
  values (no `HAVING`).
- **Fields** are refused: a client `fields` input fails the parse with `FEATURE_UNSUPPORTED`, and a
  schema's `fields.default` is not applied. The row shape is the output keys.
- **Relations** are still parsed, because they gate which relation paths a filter may traverse. They are
  never hydrated into the rows, and the grouped entry points join only the relations a filter traverses.
- **Sorts** may name output keys only: `sort=-count` or `sort=bucket` are accepted, `sort=age` and
  `sort=realm.name` are rejected under the usual [sorts policy](/guide/sort#on-violation). The schema's
  `sorts.default`, `sorts.validate` and `sorts.indexed` do not apply. Without a sort, rows are ordered
  by every group key ascending, in declared order.
- **Pagination** limits group rows, and `pagination.maxLimit` caps them. A dashboard asking for 744 hourly
  buckets times several scopes can exceed a typical `maxLimit`. The SQL and TypeORM adapters run no
  separate count query, so **`rows.length === limit` is the signal that the series may be truncated**;
  ask for the next page (`offset`) or narrow the window. The memory adapter additionally returns `total`.

An aggregates-only query (`aggregate=count` without `group`) answers exactly one row. Groups over zero
matching rows answer zero rows.

`null` (and, in memory, a missing value) is a group of its own. **Where the `null` group lands in the order
differs by engine and is not normalized:** PostgreSQL and the memory adapter sort it last ascending (first
descending), MySQL and SQLite first ascending. A client that needs a stable position should not rely on it,
or should filter the `null` rows out (`exists(scope)`, or `filter[scope]=!null` in the legacy dialect).

## Buckets are UTC {#buckets}

`bucket(column, unit)` truncates to the start of the UTC hour, day or month and is returned as ISO text,
`YYYY-MM-DDTHH:MM:SS.000Z`, byte-identical to `Date#toISOString()`. The text is produced by the database,
never by the driver, so the answer does not depend on the host's time zone. The unit is inlined from a
closed list and never bound as a parameter.

Know your column:

- **PostgreSQL `timestamptz` through `@rapiq/adapter-sql`**: standalone SQL has no column metadata and
  treats every column as a zone-less `datetime`, which PostgreSQL would truncate in the session time zone.
  Override `temporalKind(field)` on the filters adapter to return `'instant'` for zoned columns (see
  [@rapiq/adapter-sql](/packages/adapter-sql#grouped-queries)). `@rapiq/adapter-typeorm` reads the entity
  metadata and needs nothing.
- **MySQL `TIMESTAMP`**: MySQL converts it to the session time zone before formatting, so it buckets in UTC
  only when the session `time_zone` is `'+00:00'`. Set it for every connection (`SET time_zone = '+00:00'`,
  or the server's `default-time-zone`). `DATETIME` columns are read as stored.
- **SQLite**: the bucket expects ISO text or `YYYY-MM-DD HH:MM:SS` text, the form TypeORM writes. Epoch
  numbers are not recognized (SQLite reads a number as a Julian day).
- **`hour` on a `date` column** answers midnight buckets, the same on every backend.
- **Prefer `bucket(...)` over a bare group on a temporal column.** A bare group returns the driver's value:
  node-postgres reads a zone-less `timestamp` as a `Date` in the host's time zone, so the same row reads
  as a different instant on a UTC+2 host than on a UTC one, while the memory adapter returns the stored
  value unchanged. Bucket text is computed in SQL and does not depend on the host.
- **MySQL collations**: a `*_ci` collation groups case variants of a bare column (`Login`, `login`) into
  one row. The memory adapter, PostgreSQL and SQLite keep them apart.

Empty buckets are not returned: see [zero-filling](#zero-fill).

## Numbers {#numbers}

`count` and `sum` are returned as JavaScript numbers on every adapter (PostgreSQL returns a string for both,
MySQL a DECIMAL string for `sum`, SQLite a number). Through TypeORM on MySQL, `count` comes back as a
string too. The SQL and TypeORM adapters convert them with `Number` in `normalizeGroupedRows` and
`normalize`. A `sum` over no non-null value is `null`. The price is precision: a sum beyond `2^53` (about
15 significant digits) or an exact decimal such as a money column may round. If you need exact decimals,
render the SQL with `executeGrouped` and read the driver values yourself instead of calling
`normalizeGroupedRows` or `normalize`.

The memory adapter adds JavaScript numbers, so a decimal sum carries float error there:
`1.1 + 2.2` is `3.3000000000000003`. PostgreSQL and MySQL add a `decimal` column exactly (`3.30`), so
compare decimal sums from memory and from the database with a tolerance, not with strict equality.

`sum` adds finite numbers only in memory; a column holding text is an application error, not a value.
The engines disagree on it: the memory adapter skips a numeric string such as `'5'`, while SQLite and
MySQL coerce text to a number and add it (PostgreSQL refuses `sum` over a text column).

## Building in code {#building}

```typescript
import { defineQuery } from '@rapiq/core';

const query = defineQuery({
    groups: [{ name: 'bucket', params: ['createdAt', 'day'] }, 'scope', 'name'],
    aggregates: ['count'],
    sorts: '-count',
});
```

A string is a term without arguments; `{ name, params }` is a call. Built-ins and bare group columns are
resolved on the spot. A call to a name the build layer does not know (`{ name: 'period', params: ['day'] }`,
or the aggregate `'revenue'`) is kept as an unresolved node: it encodes to `period(day)` for a server that
declares `period`, but no adapter executes it. `BuildError` reports an invalid identifier (`KEY_INVALID`),
bad arguments (`KEY_VALUE_INVALID`) and a duplicate output key (`KEY_AMBIGUOUS`).

`createURLCodec().encode(query)` writes `group=` and `aggregate=` after every other parameter, so the
encoding of a query without groups is unchanged. A schema-aware encode validates them like the server
would.

## Merging {#merging}

`mergeQueries` accepts groups or aggregates from one side only, or identical ones from both. Two different
non-empty definitions throw `MergeError` (`KEY_AMBIGUOUS`): a union or a left win would fabricate or drop a
grain. "Identical" compares the resolved lowering too, so a term resolved by a parse and the same wire form
built unresolved on the client (`period(day)` from `defineQuery`) are **not** identical and are refused as
well: merge the parsed query with filters or pagination, not with a second copy of its groups. Filters keep
merging as a conjunction, so a server-side reach condition appended with `filters.and()` composes with a
grouped query as usual.

## Executing {#executing}

A grouped query answers rows, not records, so every adapter has a separate entry point. The record entry
points (`execute`, `compileQuery`, `applyQuery`, prisma `findMany` / `count`) refuse a grouped query with
`AdapterError` (`FEATURE_UNSUPPORTED`, feature `groups`).

| Adapter | Entry point | Buckets |
|---|---|---|
| [@rapiq/adapter-memory](/packages/adapter-memory#grouped-queries) | `applyGroupedQuery(query, data)` / `compileGroupedQuery(query)` | every unit |
| [@rapiq/adapter-sql](/packages/adapter-sql#grouped-queries) | `adapter.executeGrouped(query)` + `normalizeGroupedRows(query, rows)` | `pg`, `mysql`, `sqlite`; `mssql` and `oracle` refuse (`groups:bucket`) |
| [@rapiq/adapter-typeorm](/packages/adapter-typeorm#grouped-queries) | `adapter.executeGrouped(query)` then `normalize(await qb.getRawMany())` | PostgreSQL, MySQL, SQLite |
| [@rapiq/adapter-prisma](/packages/adapter-prisma#limitations) | none: refused (`groups`) | |
| [@rapiq/adapter-drizzle](/packages/adapter-drizzle#limitations) | none: refused (`groups`) | |

TypeORM, the common case:

```typescript
import { TypeormAdapter } from '@rapiq/adapter-typeorm';

const queryBuilder = dataSource.getRepository(Event).createQueryBuilder('event');

const { normalize } = new TypeormAdapter({ queryBuilder }).executeGrouped(query);
const rows = normalize(await queryBuilder.getRawMany());
// [{ bucket: '2026-09-22T00:00:00.000Z', scope: 'auth', name: 'login', count: 3 }, ...]
```

Build a fresh builder per call. `executeGrouped` rewrites the builder in place, and a second call on the
same builder finds the first call's `GROUP BY` and is refused (`groups:builder`).

In memory, for tests and guards that must agree with the database:

```typescript
import { applyGroupedQuery } from '@rapiq/adapter-memory';

const { data, total, pagination } = applyGroupedQuery(query, events);
```

::: warning Filters across a to-many relation
A filter on a to-many relation path (`filter[items.name]=...`) joins that relation, and a join repeats
each root row per related row, which inflates `count` and `sum`. `@rapiq/adapter-typeorm` knows the
cardinality and refuses aggregates over any to-many join (`aggregates:fan-out`). Standalone
`@rapiq/adapter-sql` has no relation metadata and cannot tell: it renders the join, and the caller owns
it (render it as a semi-join, `EXISTS`, or do not allow to-many filter paths on a grouped endpoint).
:::

## Zero-filling {#zero-fill}

A bucket without matching rows is absent from the answer. Because every bucket key is an ISO instant, the
client fills the gaps from a plain `Date` loop:

```typescript
const byKey = new Map(rows.map((row) => [row.bucket, row]));
const series = [];
for (let t = from.getTime(); t < to.getTime(); t += 24 * 60 * 60 * 1000) {
    const bucket = new Date(t).toISOString();
    series.push(byKey.get(bucket) ?? { bucket, count: 0 });
}
```

(`from` must itself be a UTC day start. Month buckets need a calendar step, `setUTCMonth`, not a fixed width.)

## Describing {#describing}

`schema.describe()` carries both parameters, so a discovery endpoint states the grouping vocabulary. Only
**open** slots are listed; a fixed slot is server policy and stays hidden:

```json
{
  "groups": {
    "allowed": ["status"],
    "functions": {
      "period": {
        "fn": "bucket",
        "params": [{ "name": "unit", "values": ["hour", "day"], "optional": false }]
      }
    }
  },
  "aggregates": {
    "functions": {
      "count": { "fn": "count", "params": [{ "name": "field", "values": ["couponId"], "optional": true }] },
      "total": { "fn": "sum", "params": [{ "name": "field", "values": ["amount", "fee"], "optional": false }] },
      "revenue": { "fn": "sum", "params": [] }
    }
  }
}
```

`null` means never declared, which for these two parameters means **nothing is permitted**
(`"groups": { "allowed": null, "functions": null }`). See [Describing a schema](/guide/schemas#describing-a-schema).

## Errors {#errors}

Every rejection below fails the parse, whatever `throwOnFailure` says: a dropped group would silently change
the grain of every row. The raised error is the general `ParseError` from a whole-query parse, or
`GroupsParseError` / `AggregatesParseError` from a standalone sub-parser, with code `INPUT_REJECTED` and
each rejection on the [issue trace](/guide/errors#issue-traces).

| Code | Trigger |
|---|---|
| `INPUT_INVALID` | the parameter value is neither a string nor a list of strings |
| `SYNTAX_INVALID` | a [grammar](#on-the-wire) violation |
| `KEY_PATH_NOT_ALLOWED` | a dotted identifier (relation path) |
| `KEY_INVALID` | an identifier that is not a valid property name |
| `KEY_NOT_ALLOWED` | a column or function the schema does not declare, a column outside an open slot, or a bound schema without the block |
| `KEY_VALUE_INVALID` | wrong number of arguments, or a unit outside the permitted units |
| `OPERATOR_UNSUPPORTED` | schemaless parse of a name that is neither a built-in nor a bare column |
| `KEY_AMBIGUOUS` | two terms with the same [output key](#output-keys) |
| `FEATURE_UNSUPPORTED` | a client `fields` input in a grouped query, or an opted-in parameter on a custom dialect without a groups / aggregates sub-parser |

Adapters raise `AdapterError` (`FEATURE_UNSUPPORTED`) with these `error.feature` tags:

| Feature | Meaning |
|---|---|
| `groups` | a grouped query reached a record entry point, or prisma / drizzle |
| `groups:empty` | a grouped entry point received a query without groups or aggregates |
| `fields:grouped` | a hand-built grouped query carries fields |
| `sorts:grouped` | a hand-built grouped query sorts by a name that is not an [output key](#output-keys) |
| `groups:unresolved` / `aggregates:unresolved` | a client-built named call that no schema resolved |
| `groups:<fn>` / `aggregates:<fn>` | a function the adapter does not implement |
| `groups:bucket` | the SQL dialect has no bucket spelling (`mssql`, `oracle`) |
| `groups:bucket-type` | the bucketed column is not temporal (TypeORM metadata, or a `temporalKind` override returning `undefined`) |
| `groups:builder` | the TypeORM builder already carries a `GROUP BY` |
| `aggregates:fan-out` | aggregates over a joined to-many relation would count join rows (TypeORM) |

A hand-built `Group` whose bucket unit is not `hour`, `day` or `month` is refused with `AdapterError` code
`KEY_VALUE_INVALID` by every adapter: the unit is inlined into SQL, so nothing outside the list may pass.

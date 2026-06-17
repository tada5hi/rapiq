# SQL

`@rapiq/sql` turns query AST nodes into **parameterized SQL fragments**. It is database-agnostic — per-database behavior is injected as a small dialect option object, not a subclass. It is also the foundation the [TypeORM adapter](/integrations/typeorm) builds on.

```sh
npm install @rapiq/core @rapiq/sql
```

## Dialects

A dialect is three callbacks:

```typescript
type DialectOptions = {
    escapeField: (input: string) => string,      // mysql: `field`, pg: "field", mssql: [field]
    paramPlaceholder: (index: number) => string, // pg: $1, mysql: ?
    regexp: (field: string, placeholder: string, ignoreCase: boolean) => string,
};
```

Presets ship for `pg`, `mysql`, `sqlite`, `mssql` and `oracle`:

```typescript
import { mysql, pg } from '@rapiq/sql';
```

::: warning
The `mssql` preset throws for `regexp` — SQL Server has no regexp operator. The `contains` / `startsWith` / `endsWith` filter operators lower to regexp conditions, so they are unavailable with that preset.
:::

## Rendering filters

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

## Other parameters

Each parameter has an adapter/visitor pair (`FieldsAdapter`/`FieldsVisitor`, `SortAdapter`/`SortsVisitor`, `PaginationAdapter`/`PaginationVisitor`, `RelationsAdapter`/`RelationsVisitor`) that collects the walked state — selected columns, order map, limit/offset, relation paths. A root `Adapter` bundles all five, and `QueryVisitor` walks a whole `Query` into it:

```typescript
import { Adapter, QueryVisitor, pg } from '@rapiq/sql';

const adapter = new Adapter(pg);
query.accept(new QueryVisitor(adapter));

const [where, params] = adapter.filters.getQueryAndParameters();
```

Composing the final `SELECT` statement from the collected pieces is the job of a backend adapter — that's exactly what [`@rapiq/typeorm`](/integrations/typeorm) does for TypeORM.

# Query AST

A parsed query is a tree of node objects from `@rapiq/core`. Parsers produce it, schemas constrain it, adapters consume it — the AST itself stays backend-agnostic.

## Nodes

| Collection node | Record node | Holds |
|---|---|---|
| `Fields` | `Field` | `name`, optional `operator` (`FieldOperator.INCLUDE` / `EXCLUDE`) |
| `Filters` | `Filter` | compound (`and` / `or`) tree of `{ operator, field, value }` conditions |
| `Relations` | `Relation` | `name` (dot-notation for nested paths) |
| `Sorts` | `Sort` | `name`, `operator` (`'ASC'` / `'DESC'`) |
| `Pagination` | — | `limit`, `offset` |

Constructing a query by hand:

```typescript
import {
    Field, Fields,
    Filter, FilterCompoundOperator, FilterFieldOperator, Filters,
    Pagination, Query, Relation, Relations, Sort, Sorts,
} from '@rapiq/core';

const query = new Query({
    fields: new Fields([new Field('id'), new Field('name')]),
    filters: new Filters(FilterCompoundOperator.AND, [
        new Filter(FilterFieldOperator.GREATER_THAN_EQUAL, 'age', 18),
        new Filters(FilterCompoundOperator.OR, [
            new Filter(FilterFieldOperator.EQUAL, 'status', 'active'),
            new Filter(FilterFieldOperator.EQUAL, 'status', 'pending'),
        ]),
    ]),
    relations: new Relations([new Relation('realm')]),
    sorts: new Sorts([new Sort('age', 'DESC')]),
    pagination: new Pagination(25, 0),
});
```

Every constructor argument is optional — omitted parameters default to empty collections.

## Filters form a tree

`Filters` is a compound node: its children are either leaf `Filter` conditions or nested `Filters`, so arbitrary `and`/`or` combinations compose naturally.

`FilterFieldOperator` members: `EQUAL`, `NOT_EQUAL`, `LESS_THAN`, `LESS_THAN_EQUAL`, `GREATER_THAN`, `GREATER_THAN_EQUAL`, `IN`, `NOT_IN`, `STARTS_WITH`, `NOT_STARTS_WITH`, `ENDS_WITH`, `NOT_ENDS_WITH`, `CONTAINS`, `NOT_CONTAINS`, `REGEX`, `MOD`, `EXISTS`, `ELEM_MATCH`.

## The visitor pattern

Nodes are consumed via double dispatch — every node has `accept(visitor)`:

```typescript
interface IFiltersVisitor { visitFilters(filters: IFilters): unknown }
interface IFilterVisitor {
    visitFilter(filter: IFilter): unknown;
    // optional per-operator fast paths:
    visitFilterEqual?(filter: IFilter): unknown;
    visitFilterGreaterThan?(filter: IFilter): unknown;
    // ...
}
```

A backend implements the visitor interfaces for the nodes it cares about and walks the query:

```typescript
query.accept(myQueryVisitor);          // whole query
query.filters.accept(myFiltersVisitor); // single parameter
```

This is how [`@rapiq/sql`](/integrations/sql) and [`@rapiq/typeorm`](/integrations/typeorm) work — new backends are added by implementing visitors, core never changes.

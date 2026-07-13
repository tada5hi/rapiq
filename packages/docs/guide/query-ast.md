# The Query AST

Under every rapiq feature sits one data structure: the `Query` — a tree of node objects from `@rapiq/core`. Parsers produce it, schemas constrain it, adapters consume it. You rarely touch it directly, but understanding it is the key to extending rapiq with your own parsers and backends.

## Nodes

| Collection node | Record node | Holds |
|---|---|---|
| `Fields` | `Field` | `name`, optional `operator` (`FieldOperator.INCLUDE` / `EXCLUDE`) |
| `Filters` | `Filter` | compound (`and` / `or`) tree of `{ operator, field, value }` conditions |
| `Relations` | `Relation` | `name` (dot-notation for nested paths) |
| `Sorts` | `Sort` | `name`, `operator` (`'ASC'` / `'DESC'`) |
| `Pagination` | — | `limit`, `offset` |

`Filters` is the only recursive node: its children are either leaf `Filter` conditions or nested `Filters`, so arbitrary `and`/`or` combinations compose naturally.

## Hand-constructing a query

Rarely necessary — [`defineQuery`](/guide/building-queries) builds the same tree from typed input — but instructive:

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

Every constructor argument is optional — omitted parameters default to empty collections, which adapters treat as no-ops.

## The visitor pattern

Nodes are consumed via double dispatch — every node has `accept(visitor)`, and backends implement visitor interfaces for the nodes they care about:

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

```typescript
query.accept(myQueryVisitor);           // whole query
query.filters.accept(myFiltersVisitor); // single parameter
```

This is how all three adapters work — [`@rapiq/sql`](/packages/sql) accumulates SQL fragments, [`@rapiq/typeorm`](/packages/typeorm) writes into a query builder, [`@rapiq/memory`](/packages/memory) returns compiled functions (`R = Predicate`). New backends are added by implementing visitors; core never changes.

## Writing a custom parser: ResolutionScope

Parsers resolve raw client keys through a `ResolutionScope` — an immutable handle on *one parameter of one schema under one failure policy*. It owns alias mapping, allow-list verdicts, relation traversal through the registry (`schemaMapping`-aware) and the throw-vs-drop policy, so a custom parser doesn't reimplement any of it:

```typescript
import { Parameter, ResolutionScope } from '@rapiq/core';

const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');

scope.resolveKey('items.id');
// { ok: true, name: 'id', path: ['items'], scope: <scope of the item schema> }

scope.resolveKey('secret');
// { ok: false, code: 'keyNotPermitted', input: 'secret', segment: 'secret' }
```

`resolveKey()` resolves a local, aliased or dotted key and reports the outcome as a discriminated union (or throws the parameter's error class when `throwOnFailure` applies). `descend('items')` enters a relation segment and returns a child scope bound to the related schema. Scopes created without any schema input are *unbound* and impose no constraints.

Custom parsers extend `BaseParser<OPTIONS, OUTPUT>` from core — the shipped parsers ([simple](/packages/parser-simple), [expression](/packages/parser-expression), [mongo](/packages/parser-mongo)) are reference implementations, each composing one sub-parser per parameter.

## Next steps

- [Error Handling](/guide/errors) — the error contract extensions should follow.
- [Package overview](/packages/) — where each shipped implementation lives.

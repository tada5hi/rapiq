# The Query AST

Under every rapiq feature sits one data structure: the `Query`, a tree of node objects from `@rapiq/core`. Parsers produce it, schemas constrain it, adapters consume it. You rarely touch it directly, but understanding it is the key to extending rapiq with your own parsers and backends.

## Nodes

| Collection node | Record node | Holds |
|---|---|---|
| `Fields` | `Field` | `name`, optional `operator` (`FieldOperator.INCLUDE` / `EXCLUDE`), optional `condition` (`ICondition`, a [row-scoped visibility gate](/guide/fields#row-scoped-fields)) |
| `Filters` | `Filter` | compound (`and` / `or` / `not`) tree of `{ operator, field, value }` conditions |
| `Relations` | `Relation` | `name` (dot-notation for nested paths) |
| `Sorts` | `Sort` | `name`, `operator` (`'ASC'` / `'DESC'`) |
| `Pagination` | *(none)* | `limit`, `offset` |

`Filters` is the only recursive built-in node: its children are `ICondition` values, including built-in leaf `Filter` conditions, nested `Filters`, or custom structural conditions. That keeps arbitrary `and`/`or` combinations composable without closing the extension set.

## Hand-constructing a query

Rarely necessary ([`defineQuery`](/guide/building-queries) builds the same tree from typed input) but instructive:

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

Every constructor argument is optional: omitted parameters default to empty collections, which adapters treat as no-ops.

## The visitor pattern

Nodes are consumed via double dispatch. Every node has `accept(visitor)`, and backends implement visitor interfaces for the nodes they care about:

```typescript
interface IConditionVisitor<R> {
    visitCondition(condition: ICondition): R;
}

interface IFiltersVisitor<R> {
    visitFilters(filters: IFilters): R;
}

interface IFilterVisitor<R> {
    visitFilter(filter: IFilter): R;
}
```

Built-in `Filter` and `Filters` nodes prefer their specialized method and fall back to `visitCondition`. A custom kind may expose its own specialized overload alongside `IConditionVisitor`. Built-in kind guards probe this double dispatch, so arbitrary property names do not cause a custom condition to be treated as a leaf or group.

Operator semantics live in the plan layer: lower a condition with `planCondition` and consume it through an `IPlanInterpreter` (or `distributeNegation` for serializers) instead of branching on operator names inside a visitor.

```typescript
query.accept(myQueryVisitor);           // whole query
query.filters.accept(myFiltersVisitor); // single parameter
```

This is how all five adapters consume the query. Three are interpreter-style: [`@rapiq/adapter-sql`](/packages/adapter-sql) accumulates SQL fragments, [`@rapiq/adapter-typeorm`](/packages/adapter-typeorm) writes into a query builder, [`@rapiq/adapter-memory`](/packages/adapter-memory) returns compiled functions (`R = Predicate`). The two serializer adapters, [`@rapiq/adapter-prisma`](/packages/adapter-prisma) and [`@rapiq/adapter-drizzle`](/packages/adapter-drizzle), implement the same `IQueryVisitor` entry point but consume filter conditions through the plan layer (`planCondition` plus `distributeNegation` feeding a pure renderer) instead of accumulating fragments, serializing the query into a plain `findMany` argument object. New backends are added by implementing visitors; core never changes.

## Type guards

Every node has a matching guard: `isQuery`, `isFields` / `isField`, `isFilters` / `isFilter`, `isRelations` / `isRelation`, `isSorts` / `isSort` and `isPagination`. They identify nodes by their visitor dispatch instead of `instanceof`, so they work across package instances (e.g. a query built by one copy of `@rapiq/core` and inspected by another) and reliably tell structurally identical nodes apart (an empty `Fields` and an empty `Sorts` carry the same members).

Their typical use is narrowing an SDK surface that accepts either raw build input or an already-built node:

```typescript
import type { IQuery, QueryBuildInput } from '@rapiq/core';
import { defineQuery, isQuery } from '@rapiq/core';

function toQuery<T extends Record<string, any>>(
    input: QueryBuildInput<T> | IQuery,
) : IQuery {
    if (isQuery(input)) {
        return input;
    }

    return defineQuery(input);
}
```

`isParameterNode` is the generic escape hatch: it accepts *any* AST node (everything carrying an `accept` method) without identifying its kind, separating built fragments from plain build input.

## Writing a custom parser: ResolutionScope

Parsers resolve raw client keys through a `ResolutionScope`: an immutable handle on *one parameter of one schema under one failure policy*. It owns alias mapping, allow-list verdicts, relation traversal through the registry (`schemaMapping`-aware) and the throw-vs-drop policy, so a custom parser doesn't reimplement any of it:

```typescript
import { Parameter, ResolutionScope } from '@rapiq/core';

const scope = ResolutionScope.for(registry, Parameter.FILTERS, 'user');

scope.resolveKey('items.id');
// { ok: true, name: 'id', path: ['items'], scope: <scope of the item schema> }

scope.resolveKey('secret');
// { ok: false, code: 'keyNotPermitted', input: 'secret', segment: 'secret' }
```

`resolveKey()` resolves a local, aliased or dotted key and reports the outcome as a discriminated union (or throws the parameter's error class when `throwOnFailure` applies). `descend('items')` enters a relation segment and returns a child scope bound to the related schema. Scopes created without any schema input are *unbound* and impose no constraints.

Custom parsers extend `BaseParser<OPTIONS, OUTPUT>` from core; the shipped parsers ([simple](/packages/parser-simple), [expression](/packages/parser-expression), [mongo](/packages/parser-mongo)) are reference implementations, each composing one sub-parser per parameter.

## Next steps

- [Error Handling](/guide/errors): the error contract extensions should follow.
- [Package overview](/packages/): where each shipped implementation lives.

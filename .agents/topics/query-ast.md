# Query AST and visitors

### Query AST (core)

```typescript
// packages/core/src/parameter/module.ts
class Query implements IQuery {
    readonly fields: IFields;        // Field { name, operator?: FieldOperator.INCLUDE|EXCLUDE }
    readonly filters: IFilters;      // compound node: FilterCompoundOperator.AND|OR|NOT over ICondition[]
    readonly pagination: IPagination;// { limit, offset }
    readonly relations: IRelations;  // Relation { name }
    readonly sorts: ISorts;          // Sort { name, operator: SortDirection.ASC|DESC }
    readonly groups: IGroups;        // Group { key, name, params, lowering?: { fn, field, args } } (optional on IQuery)
    readonly aggregates: IAggregates;// Aggregate, same members; key = name + camel-cased params (sum(total_amount) -> sumTotalAmount)
}
```

Filters form an extensible tree: `Filters` (and/or/not compound, children are `ICondition[]` — built-in nested `Filters`, leaf `Filter`, or custom structural conditions) and `Filter` (built-in leaf condition `{ field, operator, value }`, operators from `FilterFieldOperator`: `EQUAL`, `LT(E)`, `GT(E)`, `IN`, `CONTAINS`, `STARTS_WITH`, `REGEX`, …).

**Negation semantics **: `not(condition)` (builder + `FilterCompoundOperator.NOT`) is the **exact null-inclusive complement** — it matches exactly the rows/bindings its interior does not, the leaf complement law extended to whole trees, identical across memory/sql/typeorm (verified by the typeorm parity + complement suites). `planCondition` normalizes a single-child `not` onto the child plan's own negated form (`not(eq)` ≙ `ne`; constants flip verdict; double negation cancels); only interiors without a negated leaf form (ordering compares, mod, size, elemMatch, multi-child groups) stay a `CompoundPlan` with `negated: true`, which SQL renders two-valued via `case when (…) then 1 else 0 end = 0` (a bare `not (…)` would drop null-bearing rows per three-valued logic). The expression dialect parses/serializes `not(…)` first-class (single twin-able leaves normalize to their twin on decode); the legacy simple dialect throws typed. `Filters.flatten()` never hoists through NOT (not associative). group negation is NOT SQL-three-valued, and `nor` stays an internal lowering alias (not public API, no wire form).

### Visitor interfaces (core)

Every backend implements per-node visitors; specialized visitor methods exist for the built-in filter node kinds:

```typescript
interface IFiltersVisitor<R> { visitFilters(filters: IFilters): R }
interface IFilterVisitor<R> { visitFilter(filter: IFilter<string, unknown>): R }
```

Built-in `Filter` / `Filters` use their specialized visitors; `ICondition` does not impose visitor dispatch on custom kinds. A custom condition can add its own visitor contract when its consumer needs one. The **built-in filters contract of record** is `ICondition → planCondition`: bundled adapters consume the operator-semantics plan, interpreter-style via `interpretPlan` (sql/typeorm/memory) or serializer-style via `distributeNegation` + a pure renderer (prisma/drizzle). Per-operator customization happens by overriding `IPlanInterpreter` handlers (semantics pre-resolved by core), never by branching on operator names in a visitor: Use the current plan interpreter contracts for per-operator behavior. A custom condition requires a consumer that understands its specialized semantics.

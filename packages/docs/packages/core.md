# @rapiq/core

The foundation every other package builds on: the query AST, the typed build layer, the schema system, parser base classes and the error hierarchy. Frameworks-free and side-neutral; callers and receivers both depend on it.

```sh
npm install @rapiq/core
```

## What's inside

| Area | Exports (selection) | Guide |
|---|---|---|
| **Query AST** | `Query`, `Fields`/`Field`, `Filters`/`Filter`, `Relations`/`Relation`, `Sorts`/`Sort`, `Pagination`, operator constants (`FilterFieldOperator`, `FilterCompoundOperator`, `FieldOperator`, `SortDirection`, `Parameter`), visitor interfaces (`IQueryVisitor`, `IFiltersVisitor`, …), `hasFieldConditions` | [The Query AST](/guide/query-ast) |
| **Build layer** | `defineQuery`, `defineFields`, `defineFilters`, `definePagination`, `defineRelations`, `defineSorts`, `mergeFiltersInput` | [Building Queries](/guide/building-queries) |
| **Condition helpers** | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `inArray`, `nin`, `startsWith`, `notStartsWith`, `endsWith`, `notEndsWith`, `contains`, `notContains`, `regex`, `mod`, `size`, `exists`, `elemMatch`, `and`, `or`, `not`, `preserve` | [Condition helpers](/guide/building-queries#condition-helpers) |
| **Composition** | `mergeQueries`, `Filters.merge` / `.and` / `.or`; `mergeFiltersInput` for per-field replace on build input; `preserve` for relation-pruning policy | [Merging & Composition](/guide/merging-queries) |
| **Plan layer** | `planCondition`, `interpretPlan`, `distributeNegation`, `IPlanInterpreter`, `FILTER_OPERATOR_SEMANTICS`, plan types (`ConditionPlan`, `ComparePlan`, `CompoundPlan`, …) | [The visitor pattern](/guide/query-ast#the-visitor-pattern) |
| **Schema system** | `defineSchema`, `Schema`, `SchemaRegistry` (incl. `getAll()`), per-parameter `define*Schema` factories, `ResolutionScope`, `Schema.describe()` | [Schemas & Validation](/guide/schemas) |
| **Parser base** | `BaseParser`, per-parameter parse-option types | [Custom parsers](/guide/query-ast#writing-a-custom-parser-resolutionscope) |
| **Errors** | `BaseError`, `ParseError` + per-parameter subclasses, `BuildError`, `MergeError`, `AdapterError`, `CodecError`, `ErrorCode` | [Error Handling](/guide/errors) |
| **Utils** | `parseKey`, `stringifyKey`, `isObject`, `isPropertySet` | |

## Typed field paths

The generics run on recursive key paths: `defineQuery<User>`, `defineSchema<User>` and every condition helper check field names (including dotted relation paths like `'realm.name'`) against the record type, with autocomplete. Paths are depth-limited to keep type-checking fast.

```typescript
defineQuery<User>({
    filters: { 'realm.name': 'master' },   // ✓ typed
    sorts: '-created_at',                  // ✗ compile error if User lacks created_at
});
```

## The plan layer

The filters contract for backend authors. A backend never branches on filter operator names: `planCondition(condition)` lowers a condition tree into a `ConditionPlan` with every semantic decision already made (negation twins resolved, null equality turned into null checks, case-fold verdicts computed), all derived from the `FILTER_OPERATOR_SEMANTICS` table, the single source of what an operator means. Interpreter-style backends (SQL, TypeORM, memory) consume the plan via `interpretPlan(plan, interpreter)` with an `IPlanInterpreter` implementation; serializer-style backends (Prisma, Drizzle) run `distributeNegation(plan)` first, which pushes group negation down to the leaves, and render only the resulting final forms. See [the visitor pattern](/guide/query-ast#the-visitor-pattern).

## What core deliberately does *not* contain

- **No wire formats**: URL parameter names and query-string handling live in [`@rapiq/codec-url`](/packages/codec-url).
- **No input dialects**: parsing simple/expression/mongo input lives in the [parser packages](/packages/parser-simple).
- **No backends**: SQL/TypeORM/Prisma/Drizzle/memory execution lives in the [adapter packages](/packages/adapter-sql).

If you only build queries in code and hand them to an in-process consumer, core is the only dependency you need.

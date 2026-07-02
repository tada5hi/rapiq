# Architecture

## Overview

Rapiq is a **query-language abstraction pipeline**: raw client input is parsed into a typed AST (`Query`), validated/constrained against a `Schema`, and consumed by backend adapters via the **visitor pattern**.

```
Client side                          Server side
-----------                          -----------
QueryBuilder / BuildInput
        │
        ▼
URLEncoder (@rapiq/codec-url-simple)
        │  query string
        ▼ ─────────────────────────► URLDecoder / SimpleParser / ExpressionParser
                                            │   (validated against Schema + SchemaRegistry)
                                            ▼
                                     Query (AST: Fields, Filters, Pagination, Relations, Sorts)
                                            │  accept(visitor)
                                            ▼
                                     QueryVisitor → Adapter (@rapiq/sql, @rapiq/typeorm)
                                            │
                                            ▼
                                     SQL fragments / mutated SelectQueryBuilder
```

## Core Design Decisions

### 1. AST + visitor instead of direct translation

Parsed queries are immutable-ish node objects (`Query`, `Filters`, `Filter`, `Fields`, `Field`, `Sorts`, `Sort`, `Relations`, `Relation`, `Pagination`) in `packages/core/src/parameter/`. Every node implements `accept(visitor)` (double dispatch). New backends are added by implementing visitor/adapter interfaces — core never changes.

### 2. Schema as server-side allow-list

A `Schema<RECORD>` declares what a client *may* request per parameter (`allowed`, `default`, `mapping`, `schemaMapping`). Parsers consult it during parsing and either drop or throw on disallowed input (`throwOnFailure`). The `SchemaRegistry` stores schemas by name so relation traversal (`schemaMapping: { items: 'item' }`) resolves nested records.

### 3. Dialects as small option objects, not subclasses

`@rapiq/sql` is database-agnostic; per-database behavior is injected via `DialectOptions` callbacks (`escapeField`, `paramPlaceholder`, `regexp`). Presets live in `packages/sql/src/dialect/`.

## Key Abstractions

### Query AST (core)

```typescript
// packages/core/src/parameter/module.ts
class Query implements IQuery {
    readonly fields: IFields;        // Field { name, operator?: FieldOperator.INCLUDE|EXCLUDE }
    readonly filters: IFilters;      // compound node: FilterCompoundOperator.AND|OR over ICondition[]
    readonly pagination: IPagination;// { limit, offset }
    readonly relations: IRelations;  // Relation { name }
    readonly sorts: ISorts;          // Sort { name, direction: SortDirection.ASC|DESC }
}
```

Filters form a two-level tree: `Filters` (and/or compound, children are `ICondition[]` — nested `Filters` or leaf `Filter`) and `Filter` (leaf condition `{ field, operator, value }`, operators from `FilterFieldOperator`: `EQUAL`, `LT(E)`, `GT(E)`, `IN`, `CONTAINS`, `STARTS_WITH`, `REGEX`, …).

### Visitor interfaces (core)

Every backend implements per-node visitors; specialized optional methods exist per filter operator:

```typescript
interface IFiltersVisitor { visitFilters(filters: IFilters): unknown }
interface IFilterVisitor {
    visitFilter(filter: IFilter): unknown;
    visitFilterEqual?(filter: IFilter): unknown;     // optional fast-path per operator
    visitFilterGreaterThan?(filter: IFilter): unknown;
    // ...
}
```

### Schema definition (core)

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';

const userSchema = defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'email'] },
    relations: { allowed: ['realm', 'items'], mapping: { abc: 'items' } },
    sort: { allowed: ['id', 'name'], default: { name: 'DESC' } },
    schemaMapping: { items: 'item' },   // relation name -> registered schema name
});

const registry = new SchemaRegistry();
registry.add(userSchema);
```

Field paths are typed via recursive generics (`NestedKeys<T>`, depth-limited) so `allowed`/`default` keys are checked against the record type.

### ResolutionScope (core)

`ResolutionScope` (`packages/core/src/schema/resolver/`) is the single owner of key resolution — schema-input normalization, alias mapping, allow-list verdicts, relation traversal through the registry (`schemaMapping`-aware, works from unregistered `Schema` instances too) and the throw-vs-drop failure policy with per-parameter error-class selection. Parsers build one scope per `parse()` call and consume two questions:

```typescript
const scope = ResolutionScope.for(registry, Parameter.SORT, options.schema, {
    relations: options.relations,           // parsed relations gate relation segments
    throwOnFailure: options.throwOnFailure, // context override, inherited by child scopes
});
scope.resolveKey('items.title'); // KeyResolution: { ok, name, path, scope } | { ok: false, code, input, segment }
scope.descend('items');          // child ResolutionScope bound to the related schema, or a failure verdict
```

Parameter quirks (sort tuple groups, fields `execute()`, filter value parsing) stay in the parsers, reached via the `scope.schema` escape hatch. Scopes created without any schema input are *unbound* and impose no traversal constraints (required for schemaless codec round-trips).

### Parsers (dialects of input)

Both parsers extend `BaseParser<OPTIONS, OUTPUT>` from core and compose one sub-parser per parameter:

- **`SimpleParser`** (`packages/parser-simple/src/module.ts`) — plain object input, URL-query-like:
  ```typescript
  parser.parse({
      fields: ['id', 'name'],
      filters: { name: 'John', age: '>=18' },
      pagination: { limit: 10, offset: 0 },
      relations: ['realm', 'items'],
      sort: { name: 'DESC' },
  }, { registry, schema: 'user' });
  ```
- **`ExpressionParser`** (`packages/parser-expression/src/module.ts`) — function-call filter expressions (values always single-quoted), tokenizer + recursive-descent parser producing the same `Filters`/`Filter` AST:
  ```
  or(and(eq(name, 'John'), gte(age, '18')), in(status, 'active', 'pending'))
  ```

### Backend adapters

`@rapiq/sql`: `QueryVisitor` (`src/visitor/module.ts`) walks the AST and delegates to per-parameter sub-visitors, which accumulate SQL fragments into an `Adapter` (`src/adapter/module.ts`, implements `IRootAdapter`). Dialect behavior comes from `DialectOptions`:

```typescript
type DialectOptions = {
    escapeField: (input: string) => string,              // mysql: `` `field` ``
    paramPlaceholder: (index: number) => string,         // pg: $1, mysql: ?
    regexp: (field: string, placeholder: string, ignoreCase: boolean) => string,
};
```

`@rapiq/typeorm`: `TypeormAdapter<QUERY extends SelectQueryBuilder>` mirrors the SQL adapter but mutates a TypeORM query builder: `adapter.withQuery(qb)` → visitor walks query → `adapter.execute()`.

`@rapiq/codec-url-simple`: `URLEncoder` uses its own `QueryVisitor` + serializers to emit a query string (`fields=...&filter[...]=...&page[limit]=...`); `URLDecoder` parses with `qs` and reuses the `Simple*Parser` classes. URL parameter names come from `URLParameter` constants.

## Error Handling

- All errors extend `BaseError` (carries a `code` from `ErrorCode`), in `packages/core/src/errors/`.
- Parsers throw `ParseError` / `FiltersParseError` when `throwOnFailure` is set on the schema; otherwise invalid input is silently dropped.
- When adding new failure modes, add an `ErrorCode` member and a static factory on the error class rather than throwing raw `Error`.

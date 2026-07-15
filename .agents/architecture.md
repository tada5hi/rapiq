# Architecture

## Overview

Rapiq is a **query-language abstraction pipeline**: raw client input is parsed into a typed AST (`Query`), validated/constrained against a `Schema`, and consumed by backend adapters via the **visitor pattern**.

```
Client side                          Server side
-----------                          -----------
defineQuery(BuildInput) / condition helpers (eq, and, or, …)
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

## Layering Principles (IR-centric)

The `Query` AST is an **intermediate representation (IR)**. Every package plays exactly one role around it:

1. **Define & interact** — client-side construction (plan 012): `defineQuery<RECORD>(QueryBuildInput)` + per-parameter `define*` fragment factories desugar typed input (scalars → `eq`, bare arrays → `in` with `null` legal, `$`-operator objects, condition-helper trees) straight to the AST — schema-free, no parsing. Condition helpers (`parameter/filters/helpers/`, one per `FilterFieldOperator`; `in` → `inArray` since `in` is reserved) build `Filter`/`Filters` nodes directly. Queries compose immutably via `mergeQueries` (left-priority; fields/relations/sorts keyed by name, pagination per-property) and the `Filters` combinators: `merge()` = per-field replace, flat root-AND only (typed `MergeError`, `ErrorCode.FILTERS_NOT_FLAT`); `and()`/`or()` = wrap & inject (server scoping — injected conditions can't be displaced by later merges). `$and`/`$or` object keys stay reserved for the mongo parser dialect (`@rapiq/parser-mongo`). `QueryBuilder` was removed — `defineQuery` replaces it.
2. **Parse to IR** — parsers transform *dialect* input (a spec for how parameters are written: "simple" object shapes, "expression" strings) into the IR, validated against a `Schema`. The `filters.validate` hook runs on every resolved/coerced leaf and may synchronously or asynchronously accept, replace or reject it without flattening compound structure. `parse()` keeps a strictly synchronous return type and throws `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER` on a Promise/thenable; `parseAsync()` awaits validators sequentially in tree order. Defaults apply if validation removes every leaf. Parsers are **transport-agnostic**: they read only the canonical `Parameter` keys (`fields`, `filters`, `pagination`, `relations`, `sort`) and know nothing about how the input crossed a process boundary.
3. **Consume the IR** — either interpret/walk it directly (`@rapiq/sql`, `@rapiq/typeorm` via visitors; `@rapiq/memory` compiles it into plain functions to evaluate in-memory objects/arrays), or…
4. **Transport the IR between application boundaries via a codec** — `@rapiq/codec-url-simple` is *one* such codec (HTTP URI scheme). The codec owns the complete wire format: the parameter wire names (`URLParameter`: `filter`, `page`, `include`, …) live **only** there, and `URLDecoder` is the boundary adapter — it accepts a raw query string *or* a pre-parsed query object (express `req.query`), maps wire names to canonical parameters and delegates to a schema-aware `SimpleParser`. App2 then works with the same IR. `@rapiq/codec-url-expression` is the sibling codec for the expression dialect (nested filter compounds in a single `filter=and(...)` param; the other four parameters share the simple wire machinery).

Codec rules settled during plan 007 (2026-07):

- **Subset law**: each dialect expresses only a subset of the IR — within it `decode(encode(q)) ≍ q` *modulo scalar type normalization* (the wire is untyped: `'5'` → `5`, `'true'` → `true`); outside it `encode` throws typed `FEATURE_UNSUPPORTED`/`OPERATOR_UNSUPPORTED` instead of silently changing semantics. The simple encoder enforces this pointwise: every emitted wire token is re-parsed and must decode back to the operator it came from.
- **Codec identity is in-band** (reverses the earlier out-of-band-only stance): `@rapiq/codec-url` ships `URLCodecRegistry` — encoding through it stamps a reserved `codec` parameter; decoding dispatches on it (absent → default simple, so plain clients keep working; unregistered name → typed `CodecError`, never a silent mis-decode). Each codec package also exports its identifier constant for out-of-band negotiation.
- **Schema-aware encode** validates by piping the plain-encoded output through the schema-bound decoder and re-encoding — parser-exact semantics by construction (drop by default, schema `throwOnFailure` opts into throwing); parameters absent from the input query are masked so schema defaults don't materialize onto the wire. The URL codecs and registry mirror the parser split with `encodeAsync()` / `decodeAsync()`; registry codec async hooks are optional so sync-only third-party codecs remain compatible.
- The shared filter-value wire grammar (`parseFilterScalar`/`parseFilterValue`/`parseFilterWireValue`/`serializeFilterValue`) lives in `@rapiq/parser-simple` (`parameter/filters/value.ts`) — the single source for scalar coercion and operator-marker parsing used by both parsers and the simple codec.

Placement rules that follow (settled during plan 006, don't re-litigate):

- Wire/transport naming never goes into `@rapiq/core` or the parser packages. Raw `req.query` handling is `URLDecoder.decode(req.query, { schema })`, **not** a parser concern.
- No cross-package re-exports — a constant lives in exactly one package; consumers import it from there.
- New transports (e.g. a future header- or body-based codec) get their own codec package encoding/decoding the same IR; parsers and adapters stay untouched.

## Core Design Decisions

### 1. AST + visitor instead of direct translation

Parsed queries are immutable-ish node objects (`Query`, `Filters`, `Filter`, `Fields`, `Field`, `Sorts`, `Sort`, `Relations`, `Relation`, `Pagination`) in `packages/core/src/parameter/`. Every node implements `accept(visitor)` (double dispatch). New backends are added by implementing visitor/adapter interfaces — core never changes.

### 2. Schema as server-side allow-list

A `Schema<RECORD>` declares what a client *may* request per parameter (`allowed`, `default`, `mapping`, `schemaMapping`). Parsers consult it during parsing and either drop or throw on disallowed input (`throwOnFailure`). The `SchemaRegistry` stores schemas by name so relation traversal (`schemaMapping: { items: 'item' }`) resolves nested records.

### 3. Dialects as small option objects, not subclasses

`@rapiq/sql` is database-agnostic; per-database behavior is injected via `DialectOptions` callbacks (`escapeField`, `paramPlaceholder`, `regexp`). Presets live in `packages/sql/src/dialect/`. Regex strings pass through unchanged for the database engine to interpret and validate; JavaScript `RegExp` values contribute their `source` and `ignoreCase` flag.

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

All parsers extend `BaseParser<OPTIONS, OUTPUT>` from core and compose one sub-parser per parameter:

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
- **`MongoParser`** (`packages/parser-mongo/src/module.ts`) — MongoDB-style filter documents with typed values (`$`-operator objects, `$and`/`$or`/`$nor` compounds, De Morgan `$not`/`$nor` negation, `$elemMatch`; six `$contains`-family operators are rapiq extensions). Only `filters` is mongo-flavored — the other four parameters reuse the simple sub-parsers. Two-class failure model: grammar errors (unknown/misplaced `$`-operators, malformed values) always throw `FiltersParseError`; field-key/allow-list failures follow the schema drop-vs-throw policy:
  ```typescript
  parser.parse({
      filters: { $or: [{ name: 'John' }, { age: { $gte: 18, $lt: 65 } }] },
  }, { schema: 'user' });
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

`@rapiq/typeorm`: `TypeormAdapter` mirrors the SQL adapter but mutates a TypeORM query builder. The builder is bound at construction (`new TypeormAdapter({ queryBuilder: qb })`); `adapter.execute(query)` then walks the query and applies the accumulated state to that builder in a single call. Filters use `andWhere`, preserving application-owned tenant/auth predicates already present on the builder. Relation aliases come from @rapiq/sql's shared, injective length-prefixed `buildRelationAlias` derivation; fields, filters, sorts and joins must all use that same function.

`@rapiq/memory`: compile-once functional visitors — the core visitor interfaces implemented with `R = compiled function` (`IFiltersVisitor<Predicate>`, `ISortsVisitor<Comparator>`, `IFieldsVisitor<Projector>`, `IPaginationVisitor<Slicer>`, `IQueryVisitor<CompiledQuery>`): `compileFilters(condition)` → `(input) => boolean`, `applyQuery(query, data)` → `{ data, total, pagination }`. The semantics contract (SQL parity for positive operators, complement law for negations — `ne`/`nin`/`not*` match null/missing —, same-element join-row binding for dotted paths over arrays, keep-tree projection where relations widen a sparse field selection) is settled in `.agents/plans/014-memory.md`; do not re-litigate decisions recorded there.

**Case semantics (settled 2026-07-14)**: string matching is case-insensitive by default and uniform across backends — the anchored operators (`contains`/`startsWith`/`endsWith`, `i`-flag regex) *and* the equality family (`eq`/`ne`/`in`/`nin`). `@rapiq/sql` folds both comparison sides through the `caseFold` dialect callback (default `lower(...)`; the mysql/mssql presets use identity because their default `*_ci` collations already compare case-insensitively and skipping `lower()` keeps plain indexes usable). Per-field opt-out: `filters.caseSensitive` on the schema, forwarded as `{ visitor: { caseSensitive } }` (sql/typeorm) or `{ filters: { caseSensitive } }` (memory). Folding is further gated on the value being a string and on `IFiltersAdapter.isCaseFoldable(field)` (default true) — `@rapiq/typeorm` overrides it via entity metadata so only string-typed columns fold (an int column filtered with a wire string `'18'` renders plain `=`, avoiding `lower(integer)` errors on pg). Range comparisons and sort ordering stay collation-governed. Do not re-litigate: `eq` stays typed/exact for non-strings, and no `ilike`-style extra operators.

`@rapiq/codec-url-simple`: `URLEncoder` uses its own `QueryVisitor` + serializers to emit a query string (`fields=...&filter[...]=...&page[limit]=...`); `URLDecoder` parses with `qs` and reuses the `Simple*Parser` classes. URL parameter names come from `URLParameter` constants.

## Error Handling

- All errors extend `BaseError` (carries a `code` from `ErrorCode`), in `packages/core/src/errors/`.
- Parsers throw `ParseError` / `FiltersParseError` when `throwOnFailure` is set on the schema; otherwise invalid input is silently dropped.
- When adding new failure modes, add an `ErrorCode` member and a static factory on the error class rather than throwing raw `Error`.

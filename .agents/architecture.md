# Architecture

## Overview

Rapiq is a **query-language abstraction pipeline**: raw client input is parsed into a typed AST (`Query`), validated/constrained against a `Schema`, and consumed by backend adapters via the **visitor pattern**.

```
Client side                          Server side
-----------                          -----------
defineQuery(BuildInput) / condition helpers (eq, and, or, …)
        │
        ▼
createURLCodec().encode (@rapiq/codec-url)
        │  query string
        ▼ ─────────────────────────► URLCodec.decode / SimpleParser / ExpressionParser
                                            │   (validated against Schema + SchemaRegistry)
                                            ▼
                                     Query (AST: Fields, Filters, Pagination, Relations, Sorts)
                                            │  accept(visitor)
                                            ▼
                                     QueryVisitor → Adapter (@rapiq/adapter-sql, @rapiq/adapter-typeorm)
                                            │
                                            ▼
                                     SQL fragments / mutated SelectQueryBuilder
```

## Layering Principles (IR-centric)

The `Query` AST is an **intermediate representation (IR)**. Every package plays exactly one role around it:

1. **Define & interact** — client-side construction (plan 012): `defineQuery<RECORD>(QueryBuildInput)` + per-parameter `define*` fragment factories desugar typed input (scalars → `eq`, bare arrays → `in` with `null` legal, `$`-operator objects, condition-helper trees) straight to the AST — schema-free, no parsing. Condition helpers (`parameter/filters/helpers/`, one per `FilterFieldOperator`; `in` → `inArray` since `in` is reserved) build `Filter`/`Filters` nodes directly. Queries compose immutably via `mergeQueries` (left-priority; fields/relations/sorts keyed by name, pagination per-property) and the `Filters` combinators: `merge()` = per-field replace, flat root-AND only (typed `MergeError`, `ErrorCode.FILTERS_NOT_FLAT`); `and()`/`or()` = wrap & inject (server scoping — injected conditions can't be displaced by later merges). `$and`/`$or` object keys stay reserved for the mongo parser dialect (`@rapiq/parser-mongo`). `QueryBuilder` was removed — `defineQuery` replaces it.
2. **Parse to IR** — parsers transform *dialect* input (a spec for how parameters are written: "simple" object shapes, "expression" strings) into the IR, validated against a `Schema`. The `filters.validate` hook runs on every resolved/coerced leaf and may synchronously or asynchronously accept it, replace it with any `ICondition` (leaf or compound, issue #840 — per-leaf policy residuals like `and(<leaf>, <scope>)` stay attached to the leaf; the simple URL dialect then throws its usual typed `FEATURE_UNSUPPORTED` on encode, and the non-flat result refuses later `merge()`s by design) or reject it, all without flattening compound structure. `parse()` keeps a strictly synchronous return type and throws `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER` on a Promise/thenable; `parseAsync()` awaits validators sequentially in tree order. Defaults apply if validation removes every leaf. Parsers are **transport-agnostic**: they read only the canonical `Parameter` keys (`fields`, `filters`, `pagination`, `relations`, `sort`) and know nothing about how the input crossed a process boundary.
3. **Consume the IR** — either interpret/walk it directly (`@rapiq/adapter-sql`, `@rapiq/adapter-typeorm` via visitors; `@rapiq/adapter-prisma`/`@rapiq/adapter-drizzle` serialize it into plain args/config objects; `@rapiq/adapter-memory` compiles it into plain functions to evaluate in-memory objects/arrays), or…
4. **Transport the IR between application boundaries via a codec** — `@rapiq/codec-url` owns the complete HTTP URL wire format. The public `URLCodec` façade accepts a raw query string or a pre-parsed query object (Express `req.query`), maps wire names (`URLParameter`: `filter`, `page`, `include`, …) to canonical parameters and delegates to internal expression/simple strategies. Encoding writes stamped expression filters by default. Decoding dispatches stamped payloads and recognizes untagged expression strings or legacy simple bracket filters, so v2 follows a read-both/write-expression migration. App2 then works with the same IR.

Codec rules settled during plan 007 (2026-07):

- **Subset law**: each dialect expresses only a subset of the IR — within it `decode(encode(q)) ≍ q` *modulo scalar type normalization* (the wire is untyped: `'5'` → `5`, `'true'` → `true`); outside it `encode` throws typed `FEATURE_UNSUPPORTED`/`OPERATOR_UNSUPPORTED` instead of silently changing semantics. The simple encoder enforces this pointwise: every emitted wire token is re-parsed and must decode back to the operator it came from.
- **Codec identity is in-band**: `URLCodec.encode()` stamps a reserved `codec` parameter (`{ stamp: false }` omits it for non-rapiq receivers). Decoding prioritizes that stamp (an empty `codec=` counts as absent); without one, registered dialects are probed via their `detect(payload)` hooks in registration order — the bundled setup selects expression for a non-empty string `filter` (or a repeated parameter of such strings, which then fails loudly) and legacy simple for any other defined `filter`, including a zero-signal empty `filter=` (dropped, tolerant). Expression is the default writer; explicit simple encoding via deprecated `URL_SIMPLE_CODEC` exists for the v2 migration. An unregistered stamped name throws typed `CodecError`, never a silent mis-decode. `URL_EXPRESSION_CODEC` and `URL_SIMPLE_CODEC` remain available for negotiation.
- **Schema-aware encode** validates by piping the plain-encoded output through the schema-bound decoder and re-encoding — parser-exact semantics by construction (drop by default, schema `throwOnFailure` opts into throwing); parameters absent from the input query are masked so schema defaults don't materialize onto the wire. The URL codecs and registry mirror the parser split with `encodeAsync()` / `decodeAsync()`; registry codec async hooks are optional so sync-only third-party codecs remain compatible.
- The shared filter-value wire grammar (`parseFilterScalar`/`parseFilterValue`/`parseFilterWireValue`/`serializeFilterValue`) lives in `@rapiq/parser-simple` (`parameter/filters/value.ts`) — the single source for scalar coercion and operator-marker parsing used by both parsers and the simple codec.

Placement rules that follow (settled during plan 006, don't re-litigate):

- Wire/transport naming never goes into `@rapiq/core` or the parser packages. Raw `req.query` handling is `createURLCodec(registry).decode(req.query, { schema })`, **not** a parser concern.
- No cross-package re-exports — a constant lives in exactly one package; consumers import it from there.
- New transports (e.g. a future header- or body-based codec) get their own codec package encoding/decoding the same IR; parsers and adapters stay untouched.

## Core Design Decisions

### 1. AST + visitor instead of direct translation

Parsed queries are immutable-ish node objects (`Query`, `Filters`, `Filter`, `Fields`, `Field`, `Sorts`, `Sort`, `Relations`, `Relation`, `Pagination`) in `packages/core/src/parameter/`. Every node implements `accept(visitor)` (double dispatch). New backends are added by implementing visitor/adapter interfaces — core never changes.

### 2. Schema as server-side allow-list

A `Schema<RECORD>` declares what a client *may* request per parameter (`allowed`, `default`, `mapping`, `schemaMapping`). Parsers consult it during parsing and either drop or throw on disallowed input (`throwOnFailure`). The `SchemaRegistry` stores schemas by name so relation traversal (`schemaMapping: { items: 'item' }`) resolves nested records. `schema.describe({ parameters? })` serializes the declared constraints into a JSON-safe, shape-NORMALIZED `SchemaDescription` (each sub-schema contributes its own `describe()`; the relation→schema target map is composed on `Schema` via `mapSchema`) — every covered parameter carries every constraint key: `null` = never declared, `[]` = explicitly nothing, `strict` normalized to effective `false`; dynamic validate hooks and the filters `default` condition are deliberately not represented.

### 3. Dialects as small option objects, not subclasses

`@rapiq/adapter-sql` is database-agnostic; per-database behavior is injected via `DialectOptions` callbacks (`escapeField`, `paramPlaceholder`, `regexp`). Presets live in `packages/adapter-sql/src/dialect/`. Regex strings pass through unchanged for the database engine to interpret and validate; JavaScript `RegExp` values contribute their `source` and `ignoreCase` flag.

Preset resolution follows one fleet-wide invariant (audited 2026-08-02, do not re-flag): **user-supplied names throw typed everywhere; derived facts fall back documented**. prisma/drizzle validate a user-supplied provider name (a typo must throw, it would break every case-insensitive filter), while typeorm's `resolveQueryDialect` derives the dialect from the query builder's driver — the user supplied nothing, an exotic driver must still work, and the pg last-resort default is documented.

## Key Abstractions

### Query AST (core)

```typescript
// packages/core/src/parameter/module.ts
class Query implements IQuery {
    readonly fields: IFields;        // Field { name, operator?: FieldOperator.INCLUDE|EXCLUDE }
    readonly filters: IFilters;      // compound node: FilterCompoundOperator.AND|OR|NOT over ICondition[]
    readonly pagination: IPagination;// { limit, offset }
    readonly relations: IRelations;  // Relation { name }
    readonly sorts: ISorts;          // Sort { name, operator: SortDirection.ASC|DESC }
}
```

Filters form a two-level tree: `Filters` (and/or/not compound, children are `ICondition[]` — nested `Filters` or leaf `Filter`) and `Filter` (leaf condition `{ field, operator, value }`, operators from `FilterFieldOperator`: `EQUAL`, `LT(E)`, `GT(E)`, `IN`, `CONTAINS`, `STARTS_WITH`, `REGEX`, …).

**Negation semantics (settled 2026-07-21, issue #811)**: `not(condition)` (builder + `FilterCompoundOperator.NOT`) is the **exact null-inclusive complement** — it matches exactly the rows/bindings its interior does not, the leaf complement law extended to whole trees, identical across memory/sql/typeorm (pinned by the typeorm parity + complement suites). `planCondition` normalizes a single-child `not` onto the child plan's own negated form (`not(eq)` ≙ `ne`; constants flip verdict; double negation cancels); only interiors without a negated leaf form (ordering compares, mod, size, elemMatch, multi-child groups) stay a `CompoundPlan` with `negated: true`, which SQL renders two-valued via `case when (…) then 1 else 0 end = 0` (a bare `not (…)` would drop null-bearing rows per three-valued logic). The expression dialect parses/serializes `not(…)` first-class (single twin-able leaves normalize to their twin on decode); the legacy simple dialect throws typed. `Filters.flatten()` never hoists through NOT (not associative). Do not re-litigate: group negation is NOT SQL-three-valued, and `nor` stays an internal lowering alias (not public API, no wire form).

### Visitor interfaces (core)

Every backend implements per-node visitors; specialized optional methods exist per filter operator:

```typescript
interface IFiltersVisitor { visitFilters(filters: IFilters): unknown }
interface IFilterVisitor { visitFilter(filter: IFilter): unknown }
```

The **filters contract of record** is `ICondition → planCondition`: every backend consumes the operator-semantics plan, interpreter-style via `interpretPlan` (sql/typeorm/memory) or serializer-style via `distributeNegation` + a pure renderer (prisma/drizzle). Per-operator customization happens by overriding `IPlanInterpreter` handlers (semantics pre-resolved by core), never by branching on operator names in a visitor: the legacy per-operator `IFilterVisitor` methods were removed at the pre-GA API freeze (2026-08-02).

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

`@rapiq/adapter-sql`: `QueryVisitor` (`src/visitor/module.ts`) walks the AST and delegates to per-parameter sub-visitors, which accumulate SQL fragments into an `Adapter` (`src/adapter/module.ts`, implements `IRootAdapter`). Dialect behavior comes from `DialectOptions`:

```typescript
type DialectOptions = {
    escapeField: (input: string) => string,              // mysql: `` `field` ``
    paramPlaceholder: (index: number) => string,         // pg: $1, mysql: ?
    regexp: (field: string, placeholder: string, ignoreCase: boolean) => string,
};
```

`@rapiq/adapter-typeorm`: `TypeormAdapter` mirrors the SQL adapter but mutates a TypeORM query builder. The builder is bound at construction (`new TypeormAdapter({ queryBuilder: qb })`); `adapter.execute(query)` then walks the query and applies the accumulated state to that builder in a single call. Filters use `andWhere`, preserving application-owned tenant/auth predicates already present on the builder. Relation aliases come from @rapiq/adapter-sql's shared, injective length-prefixed `buildRelationAlias` derivation; fields, filters, sorts and joins must all use that same function.

`@rapiq/adapter-sql`'s exported base classes — INCLUDING their protected members — are an intended extension surface, consumed by `@rapiq/adapter-typeorm`'s subclasses (typeorm even owns `executed`, declared in sql's types). The two packages version in lockstep through the linked release group, but changes to that surface are semver-relevant for external subclassers.

`@rapiq/adapter-prisma`: pure IR **serializer**. `PrismaAdapter.execute(query)` is stateless (one
instance per app, not per request; composition happens BEFORE serialization via
`mergeQueries`/`filters.and()`, so there is no accumulation API) and returns a plain
`findMany` args object (`{ where, select | include, orderBy, take, skip }`) plus the applied
pagination; `@prisma/client` is not a dependency (model facts come through the local
`IMetadata` interface, fed by `defineMetadata(...)`; prisma 7 prunes every runtime
datamodel to names and kinds, `Prisma.dmmf` included, so on v7 the datamodel is
hand-written and pruned input is rejected typed). The `where` is
produced by a pipeline of pure passes: `planCondition` then core's `distributeNegation`
then quantifier factoring then a leaf-literal table (`adapter/where.ts`). Settled during
plan 024, do not re-litigate:

- **Negation is eliminated before rendering.** Prisma's `not`/`NOT` are three-valued and
  drop null rows, so the renderer consumes `distributeNegation` (in CORE, next to the
  semantics table, because complement selection is operator semantics, not rendering) and
  only ever sees leaves in final form. The settled contract behind the transform: group
  negation is the two-valued complement PER BINDING with the quantifier outermost (sql
  wraps CASE per join row, memory negates per binding context), so De Morgan applies and
  negation commutes through `elemMatch`: `not(elemMatch(c))` selects records with an
  element FAILING c, not records without a matching element. The null arm of a complement
  is dropped only when metadata proves the column non-nullable; a null check on a
  *relation* renders as a presence test (`{ rel: { is: {} } }` and its `NOT`, both
  two-valued), and `exists()` on a to-many is constantly true (a collection is never
  absent).
- **Same-element binding holds.** Conditions sharing a to-many path inside a conjunction
  are factored into ONE `some` scope, reproducing the per-join-row semantics of sql/typeorm
  and memory's shared binding; `∃` distributes over OR so disjunctions need none; mixed
  root/relation trees are expanded distributively first (capped at 64 conjuncts, typed
  error beyond: loud beats a silent semantic downgrade). Every quantifier (and to-one hop)
  gains a `{ none: {} }`/absence arm exactly when its interior evaluates true at the
  all-null binding an empty collection contributes: ONE rule replaces all previous ad-hoc
  null-arm cases.
- **`metadata` and `provider` are required options.** The four metadata questions
  (`isRelation` / `isToMany` / `isNullable` / `isString`) each change what a *valid* prisma
  filter looks like, so a wrong guess is a runtime validation error, never graceful
  degradation. Do not re-add fallbacks: an earlier cut had them and every one was an
  unverified assumption sold as a "documented limitation".
- **The parity gate is a real engine**, not a model: `@prisma/client` is a devDependency and
  `npm run test:db` (CI's `tests-db` job, where ALL engine specs live so the default job
  stays codegen-free) replays the matrix through a query engine: SQLite by default,
  PostgreSQL under `DB_TYPE=postgres`: cross-checked against `@rapiq/adapter-memory`. Findings that
  came from measurement, not reasoning: `exists()` on a to-many relation is constantly true
  (a collection is never *absent*), and the `%`/`_` case-fold veto belongs on the equality
  family ONLY: `equals` lowers to ILIKE and wildcards, `in`/`notIn` never do.
- **Case folding** is `mode: 'insensitive'`, gated on a per-connector preset
  (`provider/`: postgres/cockroach/mongo only; mysql/sqlserver are already collation-CI,
  the same reasoning as `@rapiq/adapter-sql`'s identity `caseFold`), on string-typedness, and on the
  value carrying no `%`/`_` (an insensitive `equals` lowers to `ILIKE`, where those would
  widen an exact comparison).
- **Unsupported by construction**: `regex`, `mod`, `size`, ITSELF, and `elemMatch` on a
  to-one relation raise a typed `AdapterError`, never approximated.

`@rapiq/adapter-drizzle`: second pure IR **serializer** (plan 026), targeting drizzle-orm v1's
relational-queries v2 object config (`{ where, columns, with, orderBy, limit, offset }` for
`db.query.<table>.findMany()`); `drizzle-orm` is a devDependency only. Reuses the settled
prisma pipeline (`planCondition` → core `distributeNegation` → same-element factoring →
leaf-literal table) with drizzle spellings settled by engine measurement (2026-08-02):

- A relation-filter object is ONE correlated `EXISTS` scope, so same-path conjuncts factor
  into a single nested object; presence is `{ rel: true }`, absence `NOT: { rel: true }`
  (the only emitted `NOT`: EXISTS is two-valued). `isNull`/`isNotNull` exist in the object
  language, so complement null arms need no CASE analogue.
- An empty `OR: []` group is STRIPPED by drizzle (matches everything), so an impossible
  root is expressed as `limit: 0`, never `{ OR: [] }` (prisma's trick would silently
  invert there).
- Case folding has no `mode` flag: the pg preset lowers the foldable families to
  `ilike`/`notIlike` with adapter-escaped operands (no wildcard veto needed — unlike
  prisma, the adapter builds the pattern), `in` decomposes into per-string `ilike` arms;
  mysql is collation-CI, sqlite `LIKE`-only (eq stays exact, documented). sqlite has no
  default LIKE escape and the filter object no `ESCAPE` clause, so an anchored operand
  carrying `%`/`_` fails typed there (`likeEscape` preset flag).
- `metadata` + `provider` required (carried prisma rule); metadata is a hand-written
  drizzle-vocabulary datamodel (`defineMetadata`), derivation from live
  `defineRelations` handles is a follow-up. Relation-path `orderBy` is typed-unsupported
  (undocumented in RQBv2; silent ignore beats nothing loud). The sqlite engine parity
  matrix runs IN THE DEFAULT suite (in-memory better-sqlite3, no codegen); `test:db`
  replays it on postgres where `ilike` exists.

`@rapiq/adapter-memory`: compile-once functional visitors — the core visitor interfaces implemented with `R = compiled function` (`IFiltersVisitor<Predicate>`, `ISortsVisitor<Comparator>`, `IFieldsVisitor<Projector>`, `IPaginationVisitor<Slicer>`, `IQueryVisitor<CompiledQuery>`): `compileFilters(condition)` → `(input) => boolean`, `applyQuery(query, data)` → `{ data, total, pagination }`. The semantics contract (SQL parity for positive operators, complement law for negations — `ne`/`nin`/`not*` match null/missing —, same-element join-row binding for dotted paths over arrays) is settled in `.agents/plans/014-memory.md`; do not re-litigate decisions recorded there.

**Include projection (revised 2026-07-27, issue #847)**: a per-relation fieldset governs the projection of an explicitly included relation, uniform across typeorm/memory/prisma. Direct field picks (any IR field entries owned by that exact relation path — client-sent OR materialized from the child schema's `fields.default`/`allowed`) narrow the include to the fieldset; only a pick-free include hydrates the whole subtree (#824 behavior, retained for schemas without a `fields` block and schemaless parsing). Picks belonging to a deeper relation never narrow the traversed prefix, gate-operand columns (#830) and excluded entries never count as picks, and typeorm's `hydrationMode: 'key'` takes precedence. Narrowing is uniform across the hydration triggers: `joinAndSelect: true` widens WHICH relations hydrate (every joined one), never how much of a fieldset-carrying one is selected (settled via AskUserQuestion 2026-07-27). Mechanically: the fields adapters flag the owning relation (`projected` on the relation entry / pick-veto on `keepAll`/`whole`), and typeorm renders a narrowed include on the `'key'` baseline — plain `leftJoin`, the fieldset's per-column selects, plus the guarded primary-key select. The pk is deliberate, not an artifact: TypeORM detects join presence through selected columns, so a fieldset that is all-NULL on a row would otherwise hydrate the relation as `null` (a real join miss and an all-NULL fieldset would be indistinguishable); memory/prisma need no pk and don't add one. The #831 dedup then only ever drops operand columns behind pick-free full joins, and `@rapiq/adapter-prisma` force-projects gate operands itself (select-only entries exempt from the narrowing veto) since its whole-include no longer covers them.

**Field visibility gates (settled 2026-07-25, issue #830)**: a `fields` `validate`/`validateMany` hook may answer with an `ICondition`, which rides on the `Field` node as `Field.condition` and means *this column is visible only on rows satisfying it*: it gates the VALUE of one column, never the row set, at the root and under any relation path. This is a deliberate backend divergence from the SQL-parity premise: `@rapiq/adapter-memory` honours the condition while projecting (`FieldsVisitor`, key omitted on failing records), whereas `@rapiq/adapter-sql`/`@rapiq/adapter-typeorm` cannot (a selection must stay a bare `alias.property` for entity hydration), so they project the column unconditionally and the gate is enforced post-fetch via memory's exported `applyFieldConditions`/`compileFieldConditions`; fail-open if a consumer skips it. `sort`/`relations` have no column to gate, so a condition verdict there is a rejection (relation-scoped row narrowing stays RFC #810). A gate also cannot be merged away (issue #839): `Fields.merge()`/`mergeQueries` throw a typed `MergeError` (`ErrorCode.FIELDS_CONDITION_DISCARDED`) on a name collision that would discard a `Field.condition` (the identical condition instance surviving on the winner is tolerated), mirroring the `FILTERS_NOT_FLAT` refusal instead of special-casing the merge law.

**Case semantics (settled 2026-07-14)**: string matching is case-insensitive by default and uniform across backends — the anchored operators (`contains`/`startsWith`/`endsWith`, `i`-flag regex) *and* the equality family (`eq`/`ne`/`in`/`nin`). `@rapiq/adapter-sql` folds both comparison sides through the `caseFold` dialect callback (default `lower(...)`; the mysql/mssql presets use identity because their default `*_ci` collations already compare case-insensitively and skipping `lower()` keeps plain indexes usable). Per-field opt-out: `filters.caseSensitive` on the schema, forwarded as the top-level `caseSensitive` option on every adapter surface (execute options on sql/typeorm, compile/apply options on memory, constructor options on prisma/drizzle; key unified at the 2026-08-02 pre-GA freeze). Folding is further gated on the value being a string and on `IFiltersAdapter.isCaseFoldable(field)` (default true) — `@rapiq/adapter-typeorm` overrides it via entity metadata so only string-typed columns fold (an int column filtered with a wire string `'18'` renders plain `=`, avoiding `lower(integer)` errors on pg). Range comparisons and sort ordering stay collation-governed. Do not re-litigate: `eq` stays typed/exact for non-strings, and no `ilike`-style extra operators.

`@rapiq/codec-url`: the public `URLCodec` façade hides two internal strategies. The expression strategy serializes nested filters into a single function-call expression and reuses the simple strategy's visitors/serializers for fields, pagination, relations and sort. The legacy simple strategy emits bracket filters (`filter[name]=...`). Both decode with `qs` and delegate to their matching parser. `createURLCodec()` registers both strategies with expression as the default writer.

## Error Handling

- All errors extend `BaseError` (carries a `code` from `ErrorCode`), in `packages/core/src/errors/`.
- Parsers throw `ParseError` / `FiltersParseError` when `throwOnFailure` is set on the schema; otherwise invalid input is silently dropped.
- When adding new failure modes, add an `ErrorCode` member and a static factory on the error class rather than throwing raw `Error`.

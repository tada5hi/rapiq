# Project Structure

npm-workspaces monorepo orchestrated by Nx, plus a Cargo workspace for the Rust crates. Every package lives in `packages/<package>/<ecosystem>`:

```
packages/<package>/node      npm package @rapiq/<package> (TypeScript; an npm workspace)
packages/<package>/rust      Rust crate rapiq-<package> (Cargo workspace member)
packages/<package>/python    PyPI package (PyO3 binding)
packages/<package>/node/binding   napi-rs crate of the package (not a workspace)
packages/docs                VitePress documentation site (no ecosystem level)
conformance/                 fixtures shared by the TS reference and the Rust port
internal-docs/rust/          Rust core notes: architecture, decisions, migration plan
```

Only `core` has `rust`, `python` and `node/binding` so far. Planned (see
`internal-docs/rust/ARCHITECTURE.md`): the umbrellas `packages/rapiq/{rust,python,node}`,
`packages/binding-support/rust`, and per-package `fixtures/`. Every npm package follows the same layout: `src/` (source), `test/` (vitest config + specs), `dist/` (build output, gitignored).

## Packages & Libraries

| Name                                                      | Type     | Description                                                                 |
|-----------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| [@rapiq/core](../packages/core/node)                           | Library  | Query AST (fields/filters/pagination/relations/sorts/groups/aggregates), visitor interfaces, schema system + registry, parser base classes, errors |
| [@rapiq/parser-simple](../packages/parser-simple/node)         | Library  | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](../packages/parser-expression/node) | Library  | Parses a function-call expression language (e.g. `and(eq(name, 'John'), gte(age, '18'))`) into a `Query` |
| [@rapiq/parser-mongo](../packages/parser-mongo/node)           | Library  | Parses MongoDB-style filter documents (e.g. `{ age: { $gte: 18 } }`, `$and`/`$or`/`$not`) into a `Query` |
| [@rapiq/codec-url](../packages/codec-url/node)                 | Library  | URL transport façade: expression-default encoding, expression + legacy simple decoding, in-band dialect dispatch; uses `qs` |
| [@rapiq/adapter-sql](../packages/adapter-sql/node)                             | Library  | Dialect-agnostic SQL adapter + visitor; ships dialect presets (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/adapter-typeorm](../packages/adapter-typeorm/node)                     | Library  | Adapter applying a parsed `Query` to a TypeORM `SelectQueryBuilder`         |
| [@rapiq/adapter-prisma](../packages/adapter-prisma/node)                       | Library  | Adapter serializing a parsed `Query` into a Prisma `findMany` args object (pure value, no prisma dependency) |
| [@rapiq/adapter-drizzle](../packages/adapter-drizzle/node)                     | Library  | Adapter serializing a parsed `Query` into a drizzle relational-queries v2 `findMany` config (pure value, no drizzle dependency) |
| [@rapiq/adapter-memory](../packages/adapter-memory/node)                       | Library  | Evaluates a parsed `Query` against in-memory objects/arrays: visitors compile the AST into plain functions (predicate/comparator/projector/slicer) |
| [@rapiq/docs](../packages/docs)                           | Docs app | VitePress documentation site (rapiq.tada5hi.net); private, not published    |

## Package Dependency Layers

Internal dependencies are declared as `peerDependencies` in each package's `package.json` — consult those for the authoritative graph. Nx builds in this order (`build` dependsOn `^build`):

```
Foundation (no internal deps):
  @rapiq/core

Layer 1 (depend on core):
  @rapiq/parser-simple
  @rapiq/adapter-sql
  @rapiq/adapter-memory
  @rapiq/adapter-prisma
  @rapiq/adapter-drizzle

Layer 2:
  @rapiq/parser-expression   (core + parser-simple)
  @rapiq/parser-mongo        (core + parser-simple)
  @rapiq/adapter-typeorm             (core + sql + typeorm)

Layer 3:
  @rapiq/codec-url           (core + parser-simple + parser-expression)
```

Changes to `@rapiq/core` affect every other package.

## Per-Package Source Layout

`@rapiq/core` — the foundation everything else builds on:

```
packages/core/node/src/
├── parameter/            # Query AST node classes + visitor interfaces
│   ├── aggregates/       # Aggregates/Aggregate (count/sum measures of a grouped read)
│   ├── call/             # CallTerm/CallLowering, GroupFunction/AggregateFunction/BucketUnit + slot tables, isCallEqual, resolveGroupedSorts, assertGroupedQuery, findGroupColumnDuplicate
│   ├── fields/           # Fields/Field (include/exclude operators)
│   ├── filters/          # Filters (compound and/or) + Filter (field-op-value condition); CONDITION_MARKER/Condition identity and preserve() pruning wrapper
│   │   └── helpers/      # typed condition helpers (eq, gte, inArray, and, or, …)
│   ├── groups/           # Groups/Group (grouped-read dimensions: bare column or bucket call)
│   ├── pagination/       # Pagination (limit/offset)
│   ├── relations/        # Relations/Relation
│   ├── sorts/            # Sorts/Sort (asc/desc)
│   ├── merge.ts          # mergeQueries: keyed left priority for fields/relations/sorts, per-property pagination, monotonic filter conjunction, groups/aggregates refuse a conflict
│   └── module.ts         # Query, IQueryVisitor (queries are built via defineQuery or parsed)
├── build/                # typed build layer: defineQuery + per-parameter define* factories
│   └── parameter/        # Build*Input types + defineFields/defineFilters/… (schema-free, direct-to-AST)
├── schema/               # Schema, defineSchema(), per-parameter sub-schemas
│   ├── parameter/        # FieldsSchema, FiltersSchema, ... + define* factories; call/ normalizes groups/aggregates function declarations (resolveCallTerm)
│   ├── registry/         # SchemaRegistry (named schemas, cross-schema resolution)
│   └── resolver/         # ResolutionScope (key/alias/allow-list/relation-path resolution)
├── parser/               # BaseParser + per-parameter parse-option types & error classes
├── errors/               # BaseError + ParseError/FiltersParseError/BuildError/MergeError + error codes
└── utils/                # key path parsing (public), mapping/allow-list helpers (internal)
```

Parser packages mirror core's parameter split:

```
packages/parser-{simple,expression,mongo}/src/
├── parameter/{fields,filters,pagination,relations,sorts}/   # one parser class per parameter
├── parameter/{call,groups,aggregates}/   # parser-simple only: call-term grammar + SimpleGroupsParser/SimpleAggregatesParser, reused by the other two dialects
└── module.ts             # SimpleParser / ExpressionParser / MongoParser composing them
```

Backend/codec packages:

```
packages/adapter-sql/node/src/
├── adapter/              # Adapter + per-parameter sub-adapters (accumulate SQL fragments); grouped/ builds executeGrouped clauses + row normalization
├── dialect/              # pg, mysql, sqlite, mssql, oracle DialectOptions presets; bucket.ts holds the mysql/sqlite bucket formats
├── visitor/              # QueryVisitor walking the AST into the adapter
└── helpers/

packages/adapter-typeorm/node/src/
└── adapter/              # TypeormAdapter + sub-adapters targeting SelectQueryBuilder

packages/adapter-prisma/node/src/
├── adapter/              # PrismaAdapter + per-parameter sub-adapters building the args object
├── metadata/             # IMetadata + Metadata/defineMetadata over a prisma datamodel (DMMF-shaped)
└── provider/             # per-connector capability presets (mode: 'insensitive' support)

packages/adapter-drizzle/node/src/
├── adapter/              # DrizzleAdapter + pure renderers (where/fields/sort/merge) for the RQBv2 findMany config
├── metadata/             # IMetadata + defineMetadata over a hand-written drizzle-vocabulary datamodel
└── provider/             # per-dialect capability presets (ilike availability, LIKE escape)

packages/adapter-memory/node/src/
├── parameter/{fields,filters,pagination,relations,sorts}/  # visitors compiling AST nodes into functions
├── query/                # CompiledQuery (matches/apply, pagination echo)
├── grouped/              # compileGroupedQuery/applyGroupedQuery (group, aggregate, UTC bucket truncation): the grouped parity oracle
├── helpers/              # value semantics (normalize/equal/compare/resolve)
└── module.ts             # QueryVisitor + compileQuery/applyQuery/compile* helpers

packages/codec-url/node/src/
├── module.ts             # public URLCodec façade + custom dialect registration (detect hooks)
├── factory.ts            # createURLCodec (bundles both; expression default; structural detects)
├── constants.ts          # URLParameter wire names + reserved CODEC_PARAMETER
├── decoder/              # shared BaseURLDecoder (qs parse + wire-name mapping pipeline)
├── utils/                # shared encode helpers (parameter mask, schema-awareness)
├── expression/           # internal expression encoder/decoder strategy
└── simple/               # internal legacy encoder/decoder + shared URL serializers
```

## Package Exports

All packages share the same export shape — single entry point, ESM-only build:

```json
{
    "type": "module",
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.mts",
            "import": "./dist/index.mjs"
        }
    }
}
```

Public API is controlled via the barrel `src/index.ts` of each package; anything not re-exported there is internal.

## Separation of Concerns

- **AST & type definitions** → `@rapiq/core` (`parameter/`)
- **What a client may request (allow-lists, defaults, mappings)** → `@rapiq/core` (`schema/`)
- **Turning raw URL input into the AST** → `@rapiq/codec-url` (dispatch + decode through parser-simple/parser-expression)
- **Turning the AST into URL transport format** → `@rapiq/codec-url` (expression-default encode; deprecated explicit simple encode)
- **Turning the AST into backend queries** → `@rapiq/adapter-sql`, `@rapiq/adapter-typeorm`, `@rapiq/adapter-prisma`, `@rapiq/adapter-drizzle`
- **Evaluating the AST against in-memory data** → `@rapiq/adapter-memory` (predicates/comparators/projectors compiled from the AST)

# Project Structure

npm-workspaces monorepo (`packages/*`) orchestrated by Nx. Every publishable package follows the same layout: `src/` (source), `test/` (vitest config + specs), `dist/` (build output, gitignored).

## Packages & Libraries

| Name                                                      | Type     | Description                                                                 |
|-----------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| [@rapiq/core](../packages/core)                           | Library  | Query AST (fields/filters/pagination/relations/sorts), visitor interfaces, schema system + registry, parser base classes, errors |
| [@rapiq/parser-simple](../packages/parser-simple)         | Library  | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](../packages/parser-expression) | Library  | Parses a function-call expression language (e.g. `and(eq(name, 'John'), gte(age, '18'))`) into a `Query` |
| [@rapiq/parser-mongo](../packages/parser-mongo)           | Library  | Parses MongoDB-style filter documents (e.g. `{ age: { $gte: 18 } }`, `$and`/`$or`/`$not`) into a `Query` |
| [@rapiq/codec-url](../packages/codec-url)                 | Library  | URL transport façade: expression-default encoding, expression + legacy simple decoding, in-band dialect dispatch; uses `qs` |
| [@rapiq/sql](../packages/sql)                             | Library  | Dialect-agnostic SQL adapter + visitor; ships dialect presets (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](../packages/typeorm)                     | Library  | Adapter applying a parsed `Query` to a TypeORM `SelectQueryBuilder`         |
| [@rapiq/memory](../packages/memory)                       | Library  | Evaluates a parsed `Query` against in-memory objects/arrays: visitors compile the AST into plain functions (predicate/comparator/projector/slicer) |
| [@rapiq/docs](../packages/docs)                           | Docs app | VitePress documentation site (rapiq.tada5hi.net); private, not published    |

## Package Dependency Layers

Internal dependencies are declared as `peerDependencies` in each package's `package.json` — consult those for the authoritative graph. Nx builds in this order (`build` dependsOn `^build`):

```
Foundation (no internal deps):
  @rapiq/core

Layer 1 (depend on core):
  @rapiq/parser-simple
  @rapiq/sql
  @rapiq/memory

Layer 2:
  @rapiq/parser-expression   (core + parser-simple)
  @rapiq/parser-mongo        (core + parser-simple)
  @rapiq/typeorm             (core + sql + typeorm)

Layer 3:
  @rapiq/codec-url           (core + parser-simple + parser-expression)
```

Changes to `@rapiq/core` affect every other package.

## Per-Package Source Layout

`@rapiq/core` — the foundation everything else builds on:

```
packages/core/src/
├── parameter/            # Query AST node classes + visitor interfaces
│   ├── fields/           # Fields/Field (include/exclude operators)
│   ├── filters/          # Filters (compound and/or) + Filter (field-op-value condition)
│   │   └── helpers/      # typed condition helpers (eq, gte, inArray, and, or, …)
│   ├── pagination/       # Pagination (limit/offset)
│   ├── relations/        # Relations/Relation
│   ├── sorts/            # Sorts/Sort (asc/desc)
│   ├── merge.ts          # mergeQueries (left-priority IR merge; per-node merge/and/or methods live on the node classes)
│   └── module.ts         # Query, IQueryVisitor (queries are built via defineQuery or parsed)
├── build/                # typed build layer: defineQuery + per-parameter define* factories
│   └── parameter/        # Build*Input types + defineFields/defineFilters/… (schema-free, direct-to-AST)
├── schema/               # Schema, defineSchema(), per-parameter sub-schemas
│   ├── parameter/        # FieldsSchema, FiltersSchema, ... + define* factories
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
└── module.ts             # SimpleParser / ExpressionParser / MongoParser composing them
```

Backend/codec packages:

```
packages/sql/src/
├── adapter/              # Adapter + per-parameter sub-adapters (accumulate SQL fragments)
├── dialect/              # pg, mysql, sqlite, mssql, oracle DialectOptions presets
├── visitor/              # QueryVisitor walking the AST into the adapter
└── helpers/

packages/typeorm/src/
└── adapter/              # TypeormAdapter + sub-adapters targeting SelectQueryBuilder

packages/memory/src/
├── parameter/{fields,filters,pagination,relations,sorts}/  # visitors compiling AST nodes into functions
├── query/                # CompiledQuery (matches/apply, pagination echo)
├── helpers/              # value semantics (normalize/equal/compare/resolve)
└── module.ts             # QueryVisitor + compileQuery/applyQuery/compile* helpers

packages/codec-url/src/
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
- **Turning the AST into backend queries** → `@rapiq/sql`, `@rapiq/typeorm`
- **Evaluating the AST against in-memory data** → `@rapiq/memory` (predicates/comparators/projectors compiled from the AST)

# Project Structure

npm-workspaces monorepo (`packages/*`) orchestrated by Nx. Every publishable package follows the same layout: `src/` (source), `test/` (vitest config + specs), `dist/` (build output, gitignored).

## Packages & Libraries

| Name                                                      | Type     | Description                                                                 |
|-----------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| [@rapiq/core](../packages/core)                           | Library  | Query AST (fields/filters/pagination/relations/sorts), visitor interfaces, schema system + registry, parser base classes, errors |
| [@rapiq/parser-simple](../packages/parser-simple)         | Library  | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](../packages/parser-expression) | Library  | Parses a function-call expression language (e.g. `and(eq(name, 'John'), gte(age, '18'))`) into a `Query` |
| [@rapiq/parser-mongo](../packages/parser-mongo)           | Library  | Parses MongoDB-style filter documents (e.g. `{ age: { $gte: 18 } }`, `$and`/`$or`/`$not`) into a `Query` |
| [@rapiq/codec-url-simple](../packages/codec-url-simple)   | Library  | URL query-string encoder (`URLEncoder`) & decoder (`URLDecoder`) for the simple dialect; uses `qs` |
| [@rapiq/codec-url-expression](../packages/codec-url-expression) | Library | URL codec for the expression dialect: nested filter compounds in a single `filter=and(...)` param; other parameters shared with codec-url-simple |
| [@rapiq/codec-url](../packages/codec-url)                 | Library  | `URLCodecRegistry` dispatching between URL codec dialects via the in-band reserved `codec` parameter (default: simple) |
| [@rapiq/sql](../packages/sql)                             | Library  | Dialect-agnostic SQL adapter + visitor; ships dialect presets (pg, mysql, sqlite, mssql, oracle) |
| [@rapiq/typeorm](../packages/typeorm)                     | Library  | Adapter applying a parsed `Query` to a TypeORM `SelectQueryBuilder`         |
| [@rapiq/docs](../packages/docs)                           | Docs app | VitePress documentation site (rapiq.tada5hi.net); private, not published    |

## Package Dependency Layers

Internal dependencies are declared as `peerDependencies` in each package's `package.json` — consult those for the authoritative graph. Nx builds in this order (`build` dependsOn `^build`):

```
Foundation (no internal deps):
  @rapiq/core

Layer 1 (depend on core):
  @rapiq/parser-simple
  @rapiq/sql

Layer 2:
  @rapiq/parser-expression   (core + parser-simple)
  @rapiq/parser-mongo        (core + parser-simple)
  @rapiq/codec-url-simple    (core + parser-simple)
  @rapiq/typeorm             (core + sql + typeorm)

Layer 3:
  @rapiq/codec-url-expression (core + parser-expression + codec-url-simple)

Layer 4:
  @rapiq/codec-url           (core + codec-url-simple + codec-url-expression)
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

packages/codec-url-simple/src/
├── encoder/              # URLEncoder + serializer/ + visitors/
├── decoder/              # URLDecoder (qs-based, reuses parser-simple parsers)
└── utils/

packages/codec-url-expression/src/
├── encoder/              # URLEncoder (filters → expression string; other params via codec-url-simple)
└── decoder/              # URLDecoder (qs-based, delegates to ExpressionParser)

packages/codec-url/src/
├── module.ts             # URLCodecRegistry (in-band `codec` param dispatch)
└── factory.ts            # createURLCodecRegistry (bundles simple + expression)
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
- **Turning raw input into the AST** → `@rapiq/parser-simple`, `@rapiq/parser-expression`, `@rapiq/codec-url-{simple,expression}` (decode)
- **Turning the AST into transport format** → `@rapiq/codec-url-{simple,expression}` (encode), `@rapiq/codec-url` (dialect dispatch via in-band `codec` param)
- **Turning the AST into backend queries** → `@rapiq/sql`, `@rapiq/typeorm`

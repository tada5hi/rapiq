# Project Structure

npm-workspaces monorepo (`packages/*`) orchestrated by Nx. Every publishable package follows the same layout: `src/` (source), `test/` (Jest config + specs), `dist/` (build output, gitignored).

## Packages & Libraries

| Name                                                      | Type     | Description                                                                 |
|-----------------------------------------------------------|----------|-----------------------------------------------------------------------------|
| [@rapiq/core](../packages/core)                           | Library  | Query AST (fields/filters/pagination/relations/sorts), visitor interfaces, schema system + registry, parser base classes, errors |
| [@rapiq/parser-simple](../packages/parser-simple)         | Library  | Parses plain object/array input (URL-query-like "simple" dialect) into a `Query` |
| [@rapiq/parser-expression](../packages/parser-expression) | Library  | Parses an infix expression language (e.g. `age gte 18 and name eq 'John'`) into a `Query` |
| [@rapiq/codec-url-simple](../packages/codec-url-simple)   | Library  | URL query-string encoder (`URLEncoder`) & decoder (`URLDecoder`) for the simple dialect; uses `qs` |
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
  @rapiq/codec-url-simple    (core + parser-simple)
  @rapiq/typeorm             (core + sql + typeorm)
```

Changes to `@rapiq/core` affect every other package.

## Per-Package Source Layout

`@rapiq/core` — the foundation everything else builds on:

```
packages/core/src/
├── parameter/            # Query AST node classes + visitor interfaces
│   ├── fields/           # Fields/Field (include/exclude operators)
│   ├── filters/          # Filters (compound and/or) + Filter (field-op-value condition)
│   ├── pagination/       # Pagination (limit/offset)
│   ├── relations/        # Relations/Relation
│   ├── sorts/            # Sorts/Sort (asc/desc)
│   └── module.ts         # Query, QueryBuilder, IQueryVisitor
├── schema/               # Schema, defineSchema(), per-parameter sub-schemas
│   ├── parameter/        # FieldsSchema, FiltersSchema, ... + define* factories
│   └── registry/         # SchemaRegistry (named schemas, cross-schema resolution)
├── parser/               # BaseParser + per-parameter base parsers
├── interpreter/          # IInterpreter<Input, Output, Options>
├── errors/               # BaseError + ParseError/FiltersParseError + error codes
└── utils/                # key path parsing, object helpers, linked-list
```

Parser packages mirror core's parameter split:

```
packages/parser-{simple,expression}/src/
├── parameter/{fields,filters,pagination,relations,sorts}/   # one parser class per parameter
└── module.ts             # SimpleParser / ExpressionParser composing them
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
```

## Package Exports

All packages share the same export shape — single entry point, dual CJS/ESM build:

```json
{
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.mjs",
            "require": "./dist/index.cjs"
        }
    }
}
```

Public API is controlled via the barrel `src/index.ts` of each package; anything not re-exported there is internal.

## Separation of Concerns

- **AST & type definitions** → `@rapiq/core` (`parameter/`)
- **What a client may request (allow-lists, defaults, mappings)** → `@rapiq/core` (`schema/`)
- **Turning raw input into the AST** → `@rapiq/parser-simple`, `@rapiq/parser-expression`, `@rapiq/codec-url-simple` (decode)
- **Turning the AST into transport format** → `@rapiq/codec-url-simple` (encode)
- **Turning the AST into backend queries** → `@rapiq/sql`, `@rapiq/typeorm`

# @rapiq/core

The foundation every other package builds on: the query AST, the typed build layer, the schema system, parser base classes and the error hierarchy. Frameworks-free and side-neutral — callers and receivers both depend on it.

```sh
npm install @rapiq/core
```

## What's inside

| Area | Exports (selection) | Guide |
|---|---|---|
| **Query AST** | `Query`, `Fields`/`Field`, `Filters`/`Filter`, `Relations`/`Relation`, `Sorts`/`Sort`, `Pagination`, operator constants (`FilterFieldOperator`, `FilterCompoundOperator`, `FieldOperator`, `SortDirection`, `Parameter`), visitor interfaces (`IQueryVisitor`, `IFiltersVisitor`, …) | [The Query AST](/guide/query-ast) |
| **Build layer** | `defineQuery`, `defineFields`, `defineFilters`, `definePagination`, `defineRelations`, `defineSorts` | [Building Queries](/guide/building-queries) |
| **Condition helpers** | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `inArray`, `nin`, `startsWith`, `notStartsWith`, `endsWith`, `notEndsWith`, `contains`, `notContains`, `regex`, `mod`, `exists`, `elemMatch`, `and`, `or` | [Condition helpers](/guide/building-queries#condition-helpers) |
| **Composition** | `mergeQueries`, `Filters.merge` / `.and` / `.or` | [Merging & Composition](/guide/merging-queries) |
| **Schema system** | `defineSchema`, `Schema`, `SchemaRegistry`, per-parameter `define*Schema` factories, `ResolutionScope` | [Schemas & Validation](/guide/schemas) |
| **Parser base** | `BaseParser`, per-parameter parse-option types | [Custom parsers](/guide/query-ast#writing-a-custom-parser-resolutionscope) |
| **Errors** | `BaseError`, `ParseError` + per-parameter subclasses, `BuildError`, `MergeError`, `AdapterError`, `CodecError`, `ErrorCode` | [Error Handling](/guide/errors) |
| **Utils** | `parseKey`, `stringifyKey`, `isObject`, `isPropertySet` | — |

## Typed field paths

The generics run on recursive key paths: `defineQuery<User>`, `defineSchema<User>` and every condition helper check field names — including dotted relation paths like `'realm.name'` — against the record type, with autocomplete. Paths are depth-limited to keep type-checking fast.

```typescript
defineQuery<User>({
    filters: { 'realm.name': 'master' },   // ✓ typed
    sort: '-created_at',                   // ✗ compile error if User lacks created_at
});
```

## What core deliberately does *not* contain

- **No wire formats** — URL parameter names and query-string handling live in the [codec packages](/packages/codec-url-simple).
- **No input dialects** — parsing simple/expression/mongo input lives in the [parser packages](/packages/parser-simple).
- **No backends** — SQL/TypeORM/memory execution lives in the [adapter packages](/packages/sql).

If you only build queries in code and hand them to an in-process consumer, core is the only dependency you need.

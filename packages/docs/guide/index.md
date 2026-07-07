# Concepts Overview

rapiq's model has four nouns — **Query**, **Schema**, **Parser**, **Adapter** — and one verb: `accept(visitor)`. Everything else is a knob on top of those four.

## Query

The `Query` is a typed AST with one node collection per parameter:

```typescript
class Query {
    readonly fields: IFields;         // Field { name, operator?: INCLUDE | EXCLUDE }
    readonly filters: IFilters;       // compound and/or tree over Filter conditions
    readonly relations: IRelations;   // Relation { name }
    readonly pagination: IPagination; // { limit, offset }
    readonly sorts: ISorts;           // Sort { name, operator: 'ASC' | 'DESC' }
}
```

Every node implements `accept(visitor)` — backends consume the AST by implementing visitor interfaces, never by inspecting it ad hoc. See [Query AST](/guide/query).

Queries are constructed three ways: typed client-side input via [`defineQuery`](/guide/build) (with condition helpers like `eq`/`and`/`or`), parsing raw wire input, or hand-assembling nodes. Queries compose with [`mergeQueries`](/guide/merge) and the filter combinators.

## Schema

A `Schema<RECORD>` declares what a client *may* request per parameter: `allowed` keys, `default` values, alias `mapping`s and `pagination.maxLimit`. Parsers consult it while parsing and either drop disallowed input or throw (`throwOnFailure`). The `SchemaRegistry` stores schemas by name so relation traversal (`schemaMapping`) resolves nested record types. See [Schemas](/guide/schema).

## Parser

Parsers turn raw input into a `Query`, validating against a schema along the way:

- [`SimpleParser`](/integrations/simple) — plain objects/arrays, URL-query-like (`{ age: '>=18' }`)
- [`ExpressionParser`](/integrations/expression) — expression strings (`and(eq(name, 'John'), gte(age, '18'))`)
- [`URLDecoder`](/integrations/url) — raw URL query strings

All of them produce the exact same AST.

## Adapter

Adapters consume the AST through visitors and translate it for a backend:

- [`@rapiq/sql`](/integrations/sql) — parameterized SQL fragments; per-database behavior injected as small dialect option objects (Postgres, MySQL, SQLite, MSSQL, Oracle)
- [`@rapiq/typeorm`](/integrations/typeorm) — mutates a TypeORM `SelectQueryBuilder` in place

```
input ──parse──► Query ──accept(visitor)──► Adapter ──► SQL / QueryBuilder
        ▲
      Schema (allow-list)
```

## Errors

All errors extend `BaseError` and carry a `code` from `ErrorCode`. Parsers throw parameter-specific errors (`FiltersParseError`, `FieldsParseError`, `SortParseError`, `RelationsParseError`, `PaginationParseError`) when `throwOnFailure` is enabled — otherwise invalid input is silently dropped. Backend adapters throw `AdapterError` (`operatorUnsupported`, `featureUnsupported`) for query shapes a dialect cannot express — including the [URL codec](/integrations/url) when a compound filter tree cannot cross the simple wire format.

The [build layer](/guide/build) throws `BuildError` on malformed input (`inputInvalid`, `keyInvalid`, `keyValueInvalid`, `operatorUnsupported`), and [merging](/guide/merge) throws `MergeError` (`filtersNotFlat`) when a replace-merge meets a compound filter tree.

## Parameter pages

Input formats and schema options, per parameter:

- [Fields](/guide/fields)
- [Filters](/guide/filters)
- [Pagination](/guide/pagination)
- [Relations](/guide/relations)
- [Sort](/guide/sort)

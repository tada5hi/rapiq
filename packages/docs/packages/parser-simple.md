# @rapiq/parser-simple

Parses plain object/array input — the URL-query-like "simple" dialect — into a [`Query`](/guide/query-ast). The [URL codec](/packages/codec-url) uses it for shared parameter parsing and legacy bracket-filter compatibility.

```sh
npm install @rapiq/core @rapiq/parser-simple
```

**Reach for it directly when** your input already uses the canonical parameter keys (`fields`, `filters`, `pagination`, `relations`, `sort`) — e.g. a JSON request body or an internal call. For raw URL input, use [`@rapiq/codec-url`](/packages/codec-url) instead.

## Usage

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';

const registry = new SchemaRegistry();
registry.add(defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'age'] },
    filters: { allowed: ['id', 'name', 'age'] },
    relations: { allowed: ['realm'] },
    sort: { allowed: ['id', 'age'] },
    pagination: { maxLimit: 50 },
}));

const parser = new SimpleParser(registry);

const query = parser.parse({
    fields: ['id', 'name'],
    filters: { name: '~jo~', age: '>=18' },
    relations: ['realm'],
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

`parse(input, options)` returns a [`Query`](/guide/query-ast). Options:

| Option | Description |
|---|---|
| `schema` | A `Schema` instance or the name of a registered schema. Omit to parse without validation. |
| `strict` | Override the schema's [strict mode](/guide/schemas#strict-mode) for this call. |
| `parameters` | Allow-list of parameters to parse, e.g. `['filters']`. A parameter not listed is neither parsed nor defaulted — the resulting `Query` leaves it empty, exactly as if neither input nor schema mentioned it. |
| `fields` / `filters` / `relations` / `pagination` / `sort` | Set to `false` to skip a parameter entirely. |

If `filters.validate` may return a Promise, use `await parser.parseAsync(input, options)`. `parse()` remains synchronous for schemas whose validators are synchronous and throws `SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER` if it encounters an async result.

## Schema defaults

A parameter absent from the input is still parsed, so schema defaults always apply: `fields.default` (or, without one, the `fields.allowed` selection), `filters.default`, `sort.default` and `pagination.maxLimit` shape the resulting `Query` even when the input is empty.

To keep schema defaults from materializing for parameters you do not intend to apply, mask them with the `parameters` option:

```typescript
// a bulk delete must apply filters only — masking pagination keeps
// the schema's maxLimit from silently truncating the row selection.
const query = parser.parse(input, {
    schema: 'user',
    parameters: ['filters'],
});
```

Masked-out relations do not gate relation paths in the other parameters — they resolve exactly as if the client had requested no relations.

## Input formats

Per-parameter input shapes and the wire operator syntax are documented on the parameter pages:

- [Fields](/guide/fields) — arrays, comma strings, `+`/`-` modifiers, per-relation records
- [Filters](/guide/filters) — `!`, `<`, `<=`, `>`, `>=`, `~…~`, comma lists, `null`
- [Pagination](/guide/pagination) — `{ limit, offset }`
- [Relations](/guide/relations) — comma strings, arrays, dotted paths
- [Sort](/guide/sort) — `-` prefix, comma lists, direction objects

## Per-parameter parsers

Each parameter also has a standalone parser class — `SimpleFieldsParser`, `SimpleFiltersParser`, `SimplePaginationParser`, `SimpleRelationsParser`, `SimpleSortParser` — with the same `(input, { schema })` signature, returning that parameter's AST node. Useful when only one parameter comes from user input. Every parser exposes `parseAsync()`; `SimpleFiltersParser` also exposes `parseTypedAsync()` alongside `parseTyped()`.

## Errors

Schema violations follow the [drop-vs-throw policy](/guide/schemas#failure-behavior-drop-vs-throw); with `throwOnFailure`, the per-parameter `ParseError` subclasses are thrown. See [Error Handling](/guide/errors).

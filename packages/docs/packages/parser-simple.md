# @rapiq/parser-simple

Parses plain object/array input — the URL-query-like "simple" dialect — into a [`Query`](/guide/query-ast). It is the workhorse parser: the [URL codec](/packages/codec-url-simple) builds on it, mapping URL wire names to the canonical parameter keys this parser reads.

```sh
npm install @rapiq/core @rapiq/parser-simple
```

**Reach for it directly when** your input already uses the canonical parameter keys (`fields`, `filters`, `pagination`, `relations`, `sort`) — e.g. a JSON request body or an internal call. For raw URL input, use the [URL decoder](/packages/codec-url-simple) instead.

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
| `fields` / `filters` / `relations` / `pagination` / `sort` | Set to `false` to skip a parameter entirely. |

## Schema defaults

A parameter absent from the input is still parsed, so schema defaults always apply: `fields.default` (or, without one, the `fields.allowed` selection), `filters.default`, `sort.default` and `pagination.maxLimit` shape the resulting `Query` even when the input is empty.

## Input formats

Per-parameter input shapes and the wire operator syntax are documented on the parameter pages:

- [Fields](/guide/fields) — arrays, comma strings, `+`/`-` modifiers, per-relation records
- [Filters](/guide/filters) — `!`, `<`, `<=`, `>`, `>=`, `~…~`, comma lists, `null`
- [Pagination](/guide/pagination) — `{ limit, offset }`
- [Relations](/guide/relations) — comma strings, arrays, dotted paths
- [Sort](/guide/sort) — `-` prefix, comma lists, direction objects

## Per-parameter parsers

Each parameter also has a standalone parser class — `SimpleFieldsParser`, `SimpleFiltersParser`, `SimplePaginationParser`, `SimpleRelationsParser`, `SimpleSortParser` — with the same `(input, { schema })` signature, returning that parameter's AST node. Useful when only one parameter comes from user input.

## Errors

Schema violations follow the [drop-vs-throw policy](/guide/schemas#failure-behavior-drop-vs-throw); with `throwOnFailure`, the per-parameter `ParseError` subclasses are thrown. See [Error Handling](/guide/errors).

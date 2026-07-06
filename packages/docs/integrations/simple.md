# Simple Parser

`@rapiq/parser-simple` parses plain object/array input — the URL-query-like "simple" dialect. It is the workhorse parser: express-style `req.query` objects feed straight into it, and the [URL codec](/integrations/url) builds on it.

```sh
npm install @rapiq/core @rapiq/parser-simple
```

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

`parse(input, options)` returns a [`Query`](/guide/query). Options:

| Option | Description |
|---|---|
| `schema` | A `Schema` instance or the name of a registered schema. Omit to parse without validation. |
| `fields` / `filters` / `relations` / `pagination` / `sort` | Set to `false` to skip a parameter entirely. |

The parser is transport-agnostic: it reads the canonical parameter keys
(`fields`, `filters`, `pagination`, `relations`, `sort`) only. To consume a
raw URL query string or an express-style `req.query` object (JSON-API wire
names like `filter`, `page`, `include`), use the [URL codec](/integrations/url)
— its decoder maps the wire names and delegates to this parser.

## Schema defaults

A parameter that is absent from the input is still parsed, so schema defaults
always apply: `fields.default` (or, without one, the `fields.allowed`
selection), `filters.default`, `sort.default` and `pagination.maxLimit` shape
the resulting `Query` even when the client sends nothing at all.

## Input formats

Per-parameter input shapes and operator syntax are documented on the parameter pages:

- [Fields](/guide/fields) — arrays, comma strings, `+`/`-` modifiers, per-relation records
- [Filters](/guide/filters) — `!`, `<`, `<=`, `>`, `>=`, `~…~`, comma lists, `null`
- [Pagination](/guide/pagination) — `{ limit, offset }`
- [Relations](/guide/relations) — comma strings, arrays, dotted paths
- [Sort](/guide/sort) — `-` prefix, comma lists, direction objects

## Per-parameter parsers

Each parameter also has a standalone parser class — `SimpleFieldsParser`, `SimpleFiltersParser`, `SimplePaginationParser`, `SimpleRelationsParser`, `SimpleSortParser` — with the same `(input, { schema })` signature, returning that parameter's AST node. Useful when only one parameter comes from user input.

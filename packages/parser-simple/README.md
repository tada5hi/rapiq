# @rapiq/parser-simple

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Parses plain object/array input — the URL-query-like "simple" dialect — into a [`Query`](https://rapiq.tada5hi.net/guide/query) AST, validated against a schema. It is the workhorse parser the [URL codec](https://www.npmjs.com/package/@rapiq/codec-url-simple) builds on.

## Installation

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

Anything outside the schema's allow-lists is silently dropped; set `throwOnFailure: true` on the schema to get a `ParseError` instead. Parameters absent from the input still receive schema defaults.

The parser is transport-agnostic: it reads the canonical parameter keys (`fields`, `filters`, `pagination`, `relations`, `sort`) only. To consume a raw URL query string or an express-style `req.query` object (JSON:API wire names like `filter`, `page`, `include`), use the [URL codec](https://www.npmjs.com/package/@rapiq/codec-url-simple) — its decoder maps the wire names and delegates to this parser.

Per-parameter parser classes (`SimpleFieldsParser`, `SimpleFiltersParser`, `SimplePaginationParser`, `SimpleRelationsParser`, `SimpleSortParser`) are exported for parsing a single parameter.

## Documentation

Full guide: [rapiq.tada5hi.net/integrations/simple](https://rapiq.tada5hi.net/integrations/simple) — per-parameter input shapes and operator syntax are on the [parameter pages](https://rapiq.tada5hi.net/guide/filters).

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

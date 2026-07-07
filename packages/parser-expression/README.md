# @rapiq/parser-expression

Part of [rapiq](https://github.com/tada5hi/rapiq) — typed REST queries: build, transport, validate, execute.

Parses a function-call expression language for filters — useful when a single string must carry a complex condition tree (search boxes, saved filters, CLI flags):

```txt
and(eq(name, 'John'), gte(age, '18'))
or(in(status, 'active', 'pending'), gt(age, '65'))
not(contains(user.name, 'Bob'))
```

## Installation

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression
```

## Usage

```typescript
import { ExpressionParser } from '@rapiq/parser-expression';

const parser = new ExpressionParser(registry);

const query = parser.parse({
    filters: "and(eq(name, 'John'), gte(age, '18'))",
    sort: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the expression language — fields, relations, pagination and sort accept the same input as [@rapiq/parser-simple](https://www.npmjs.com/package/@rapiq/parser-simple), and the whole thing returns the same [`Query`](https://rapiq.tada5hi.net/guide/query) AST. A standalone `parseFilters(input, options)` returns just the `Filters` node.

The grammar: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `nin`, `contains`, `startsWith`, `endsWith` (and negations) as leaf conditions, composed with `and(…)` / `or(…)` / `not(…)`. Values are always single-quoted (`gte(age, '18')`); quoted numerals coerce to numbers, `'true'`/`'false'` to booleans, `'null'` to `null`.

Syntax errors and schema violations throw `FiltersParseError` immediately — the expression parser has no silent-drop mode for malformed expressions.

## Documentation

Full guide (grammar & operator table): [rapiq.tada5hi.net/integrations/expression](https://rapiq.tada5hi.net/integrations/expression)

## License

Published under the [MIT License](https://github.com/tada5hi/rapiq/blob/master/LICENSE).

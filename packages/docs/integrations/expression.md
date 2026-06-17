# Expression Parser

`@rapiq/parser-expression` parses an expression language for filters — useful when a single string must carry a complex condition tree (search boxes, saved filters, CLI flags).

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression
```

## The language

Conditions are function-call expressions; `and` / `or` / `not` compose them:

```
and(eq(name, 'John'), gte(age, '18'))
or(in(status, 'active', 'pending'), gt(age, '65'))
not(eq(name, 'foo'))
contains(user.name, 'Bob')
```

| Function | Meaning | AST operator |
|---|---|---|
| `eq(field, value)` | equal | `EQUAL` |
| `lt` / `lte` / `gt` / `gte` | comparisons | `LESS_THAN`, … |
| `in(field, v1, v2, …)` | in list | `IN` |
| `nin(field, v1, v2, …)` | not in list | `NOT_IN` |
| `contains(field, value)` | substring | `CONTAINS` |
| `startsWith(field, value)` | prefix | `STARTS_WITH` |
| `endsWith(field, value)` | suffix | `ENDS_WITH` |
| `and(expr, …)` / `or(expr, …)` | compound | `Filters` node |
| `not(expr, …)` | negation | flips operators, `and` ↔ `or` |

Rules:

- **Values are always single-quoted** — `gte(age, '18')`, not `gte(age, 18)`. Quoted numerals are coerced to numbers, `'true'`/`'false'` to booleans, `'null'` to `null`. Escape a quote by doubling it (`'it''s'`).
- Field names allow `[A-Za-z0-9_-]` with dots for relation paths (`user.name`).
- `not(...)` cannot wrap the match expressions (`contains`, `startsWith`, `endsWith`).

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

Only the `filters` parameter uses the expression language — fields, relations, pagination and sort accept the same input as the [simple parser](/integrations/simple), and the whole thing returns the same [`Query`](/guide/query) AST.

There is also a standalone `parseFilters(input, options)` returning just the `Filters` node.

## Errors

Syntax errors and schema violations throw `FiltersParseError` immediately — the expression parser has no silent-drop mode for malformed expressions.

# @rapiq/parser-expression

Parses an expression language for filters: useful when a single string must carry a complex condition tree (search boxes, saved filters, CLI flags). The [expression URL codec](/packages/codec-url#expression-dialect) builds on it.

```sh
npm install @rapiq/core @rapiq/parser-simple @rapiq/parser-expression
```

## The language

Conditions are function-call expressions; `and` / `or` / `not` compose them:

```txt
and(eq(name, 'John'), gte(age, '18'))
or(in(status, 'active', 'pending'), gt(age, '65'))
not(eq(name, 'foo'))
contains(user.name, 'Bob')
elemMatch(items, and(eq(id, '1'), eq(active, 'true')))
elemMatch(scores, gt($this, '5'))
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
| `elemMatch(field, expr)` | array element match | `ELEM_MATCH` |
| `size(field, n)` | array length (non-negative integer) | `SIZE` |
| `and(expr, …)` / `or(expr, …)` | compound | `Filters` node |
| `not(expr)` | [negation](/guide/filters#negation): the exact complement of the interior | a single leaf with a negated twin normalizes to it (`not(eq(…))` → `NOT_EQUAL`, `not(in(…))` → `NOT_IN`, …), a double `not` cancels; everything else (ordering comparisons, `size`, `elemMatch`, groups) stays a first-class `NOT` `Filters` node |

Rules:

- **Values are always single-quoted**: `gte(age, '18')`, not `gte(age, 18)`. Quoted numerals are coerced to numbers, `'true'`/`'false'` to booleans, `'null'` to `null`. Escape a quote by doubling it (`'it''s'`).
- Quoted values are never comma-split: `eq(name, 'a,b')` is the literal string `'a,b'`; lists are separate arguments.
- Field names allow `[A-Za-z0-9_-]` with dots for relation paths (`user.name`).
- Inside an `elemMatch` interior, field paths are relative to the array element; the reserved `$this` marker (core's `ITSELF` constant) addresses the element itself. Outside an interior, `$this` is an error.

For the functions above, the language mirrors the [condition helpers](/guide/building-queries#condition-helpers): `eq('name', 'John')` in code ≙ `eq(name, 'John')` on the wire. The negated leaf helpers (`ne`, `notContains`, `notStartsWith`, `notEndsWith`) have no function spelling of their own (only `nin` does): write `not(eq(…))`, `not(contains(…))`, …, which normalize back to the twin on decode.

## Usage

```typescript
import { ExpressionParser } from '@rapiq/parser-expression';

const parser = new ExpressionParser(registry);

const query = parser.parse({
    filters: "and(eq(name, 'John'), gte(age, '18'))",
    sorts: '-age',
    pagination: { limit: 25 },
}, { schema: 'user' });
```

Only the `filters` parameter uses the expression language; fields, relations, pagination and sorts accept the same input as the [simple parser](/packages/parser-simple), and the whole thing returns the same [`Query`](/guide/query-ast).

There is also a standalone `parseFilters(input, options)` returning just the `Filters` node. For schemas with asynchronous filter validators, use `parseAsync()` / `parseFiltersAsync()` on the query parser, or `parseAsync()` / `parseExactAsync()` on `ExpressionFiltersParser`.

## Errors

Syntax errors and schema violations always fail the parse: the expression parser has **no silent-drop mode** for malformed expressions. The raised error is the aggregated `inputRejected` failure (`FiltersParseError` from `parseFilters`, the general `ParseError` from a whole-query parse), and the [issue trace](/guide/errors#issue-traces) on `error.issues` carries the specific code: `SYNTAX_INVALID` for a malformed expression, the key-related codes (`keyNotAllowed`, `keyPathInvalid`, …) for schema violations. See [Error Handling](/guide/errors).

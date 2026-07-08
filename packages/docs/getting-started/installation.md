# Installation

All packages are published independently — install only what you need.
`@rapiq/core` is a peer dependency of every other package, so it is always part of the mix.

## Client side

To build queries and encode them as URL query strings:

```sh
npm install @rapiq/core @rapiq/codec-url-simple
```

## Server side

To decode and validate incoming URL query input (a raw query string or a pre-parsed
object like express' `req.query`):

```sh
npm install @rapiq/core @rapiq/codec-url-simple
```

Add the backend adapter that matches your stack:

::: code-group

```sh [SQL]
npm install @rapiq/sql
```

```sh [TypeORM]
npm install @rapiq/sql @rapiq/typeorm
```

:::

## Optional packages

| Package | Install when… |
|---|---|
| `@rapiq/parser-simple` | your input already uses the canonical parameter keys (`filters`, `pagination`, …) instead of URL wire names — the layer `@rapiq/codec-url-simple` builds on |
| `@rapiq/parser-expression` | you want to accept function-call filter expressions like `and(eq(name, 'John'), gte(age, '18'))` |
| `@rapiq/parser-mongo` | you want to accept MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| `@rapiq/codec-url-expression` | you want the expression dialect on the wire — a nested filter compound in a single `filter=and(...)` parameter |
| `@rapiq/codec-url` | you accept more than one URL codec dialect and want dispatch via the reserved `codec` parameter |

## Requirements

- Node.js ≥ 22 (for the server-side packages; the client-side packages run in any modern bundler/browser environment)
- TypeScript is optional but recommended — typed key paths are a core feature.

# Installation

All packages are published independently — install only what your side of the wire needs. `@rapiq/core` is a peer dependency of every other package, so it is always part of the mix.

## Caller (client) side

To build typed queries and encode them as URL query strings:

```sh
npm install @rapiq/core @rapiq/codec-url-simple
```

That's everything a frontend needs. If you only build queries and hand them to an in-process consumer (no URL), `@rapiq/core` alone is enough.

## Receiver (server) side

To decode and validate incoming URL query input — a raw query string or a pre-parsed object like express' `req.query`:

```sh
npm install @rapiq/core @rapiq/codec-url-simple
```

Then add the backend that executes queries against your data:

::: code-group

```sh [TypeORM]
npm install @rapiq/sql @rapiq/typeorm
```

```sh [Raw SQL]
npm install @rapiq/sql
```

```sh [In-memory]
npm install @rapiq/memory
```

:::

## Optional packages

| Package | Install when… |
|---|---|
| [@rapiq/parser-simple](/packages/parser-simple) | your input already uses the canonical parameter keys (`filters`, `pagination`, …) instead of URL wire names — the layer `@rapiq/codec-url-simple` builds on |
| [@rapiq/parser-expression](/packages/parser-expression) | you want to accept function-call filter expressions like `and(eq(name, 'John'), gte(age, '18'))` |
| [@rapiq/parser-mongo](/packages/parser-mongo) | you want to accept MongoDB-style filter documents like `{ age: { $gte: 18 } }` |
| [@rapiq/codec-url-expression](/packages/codec-url-expression) | you need nested `and`/`or` filter trees to cross the URL boundary |
| [@rapiq/codec-url](/packages/codec-url) | you accept more than one URL dialect and want automatic dispatch |
| [@rapiq/memory](/packages/memory) | you want to evaluate a `Query` against in-memory objects — e.g. authorization guards or mock backends |

Not sure which combination you need? The [package overview](/packages/) walks through the decision.

## Requirements

- **Node.js ≥ 22** for the server-side packages; the client-side packages run in any modern bundler/browser environment.
- **TypeScript** is optional but strongly recommended — typed field paths are a core feature.

## Next steps

- [Quick Start](/guide/quick-start) — wire everything together in one walkthrough.

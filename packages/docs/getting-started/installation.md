# Installation

All packages are published independently — install only what you need.
`@rapiq/core` is a peer dependency of every other package, so it is always part of the mix.

## Client side

To build queries and encode them as URL query strings:

```sh
npm install @rapiq/core @rapiq/codec-url-simple
```

## Server side

To parse and validate incoming query input:

```sh
npm install @rapiq/core @rapiq/parser-simple
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
| `@rapiq/parser-expression` | you want to accept infix filter expressions like `age gte 18 and name eq 'John'` |
| `@rapiq/codec-url-simple` | you want to decode full URL query strings on the server (it builds on `@rapiq/parser-simple`) |

## Requirements

- Node.js ≥ 22 (for the server-side packages; the client-side packages run in any modern bundler/browser environment)
- TypeScript is optional but recommended — typed key paths are a core feature.

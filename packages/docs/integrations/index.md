# Integrations

Everything outside `@rapiq/core` is an integration: parsers turn input *into* the query AST, codecs move it over the wire, adapters turn it into backend queries.

## Input → Query

| Package | Input | Page |
|---|---|---|
| `@rapiq/parser-simple` | Plain objects & arrays (URL-query-like) | [Simple Parser](/integrations/simple) |
| `@rapiq/parser-expression` | Expression strings (`and(eq(name, 'John'), gte(age, '18'))`) | [Expression Parser](/integrations/expression) |
| `@rapiq/codec-url-simple` | Raw URL query strings (decode) | [URL Codec](/integrations/url) |
| `@rapiq/codec-url-expression` | Raw URL query strings, expression filter dialect (decode) | [URL Codec](/integrations/url#expression-dialect) |

## Query → transport

| Package | Output | Page |
|---|---|---|
| `@rapiq/codec-url-simple` | URL query strings (encode) | [URL Codec](/integrations/url) |
| `@rapiq/codec-url-expression` | URL query strings carrying nested filter compounds | [URL Codec](/integrations/url#expression-dialect) |
| `@rapiq/codec-url` | Dialect dispatch via in-band `codec` parameter | [URL Codec](/integrations/url#codec-registry) |

## Query → backend

| Package | Target | Page |
|---|---|---|
| `@rapiq/sql` | Parameterized SQL fragments, five dialect presets | [SQL](/integrations/sql) |
| `@rapiq/typeorm` | TypeORM `SelectQueryBuilder` | [TypeORM](/integrations/typeorm) |

All integrations meet in the same [Query AST](/guide/query) — they compose freely.

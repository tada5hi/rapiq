# Migration from v1

v2 splits the single `rapiq` package into focused `@rapiq/*` packages and replaces string-building with a typed query AST. This page is a running log of the intentional changes — it is assembled into a full step-by-step guide as v2 stabilizes.

::: info v1 docs
The v1 documentation lives on the [v1 branch](https://github.com/tada5hi/rapiq/tree/v1).
:::

## Package split

| v1 | v2 |
|---|---|
| `rapiq` (everything) | `@rapiq/core` + the packages for your side of the wire — see [Installation](/guide/installation) |

## API mapping

| v1 | v2 |
|---|---|
| `buildQuery(input)` → string | [`defineQuery(input)`](/guide/building-queries) → `Query`, then `createURLCodec().encode(query)` |
| `parseQuery(input, options)` | [`createURLCodec(registry).decode(input, { schema })`](/guide/wire) for URL input; [`SimpleParser`](/packages/parser-simple) for canonical object input |
| per-call allow-list options | a named [`Schema`](/guide/schemas) in a `SchemaRegistry` |

## Behavior changes

### Filters: `~` prefix position (breaking)

In v1, `~text` meant *starts with* (`text%`) — the only LIKE form the dialect had. v2 uses a richer, position-based mapping:

| Wire value | v1 | v2 |
|---|---|---|
| `text~` | — | starts with (`text%`) |
| `~text` | starts with (`text%`) | ends with (`%text`) |
| `~text~` | — | contains (`%text%`) |

**v1 clients sending `~text` change meaning from starts-with to ends-with.** Rewrite them to `text~` — or move to typed [condition helpers](/guide/building-queries#condition-helpers) / the [expression dialect](/packages/codec-url#expression-dialect), which have no positional magic.

### Filters: magic value strings are wire-only

v1 accepted `'>=18'`, `'~jo~'`, `'!null'` as *build input*. In v2, the string prefixes remain part of the wire format only — build input uses operator objects (`{ $gte: 18 }`, `{ $contains: 'jo' }`, `{ $ne: null }`) or condition helpers.

### Expression dialect: quoted values are never comma-split

`eq(name, 'a,b')` now parses to the plain string `'a,b'`. Lists are expressed as separate arguments (`in(status, 'a', 'b')`), not comma strings.

### Codecs: loud failures instead of silent lossiness (breaking)

v1's URL build silently emitted whatever it was given. v2's `encode` throws typed errors (`FEATURE_UNSUPPORTED`, `OPERATOR_UNSUPPORTED`) for queries the wire dialect cannot represent. The default expression dialect carries nested compounds, `or(...)` and same-field conditions natively, so its typed failures are limited to operators without a grammar production (regex/mod/exists/elemMatch) and values that would decode to a different condition. Only the deprecated explicit simple encoding (`URL_SIMPLE_CODEC`) additionally rejects nested compounds, `or(...)` and same-field conditions. See [What fits on the wire](/guide/wire#what-fits-on-the-wire).

### URL filters: expression output, legacy input

The v2 URL codec writes stamped expression filters by default. Its decoder still recognizes v1-style bracket filters, so deploy receiving applications before switching callers. Deprecated simple encoding remains available explicitly with `URL_SIMPLE_CODEC` during the v2 migration.

### Filters: string equality is case-insensitive (breaking)

In v1, `eq`/`in` on strings delegated case behavior to the database — the same query matched `Super Hero` for `super hero` on MySQL (`*_ci` collation) but not on Postgres. v2 normalizes the whole equality family (`eq`, `ne`, `in`, `nin`) **and** the anchored operators (`contains`, `startsWith`, `endsWith`) to case-insensitive string matching on every backend; `@rapiq/sql` renders `lower(field) = lower(?)` on case-sensitive dialects. Opt identifier/token fields out with the schema's [`caseSensitive`](/guide/filters#case-sensitivity) list.

## Coming from typeorm-extension?

The server-pipeline differences (strict mode, join defaults, `applyQuery`) have [their own page](/guide/migration-typeorm-extension).

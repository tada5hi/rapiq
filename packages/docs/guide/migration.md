# Migration from v1

Running log of intentional behavior changes vs rapiq v1 (and
typeorm-extension), recorded as they are introduced. The full
migration guide is assembled from these entries once v2 stabilizes.

## Filters

### `~` prefix position (breaking)

In v1, `~text` meant *starts with* (`text%`) — the only LIKE form the
dialect had. v2 keeps its richer, position-based mapping instead:

| Wire value | v1 | v2 |
|---|---|---|
| `text~` | — | starts with (`text%`) |
| `~text` | starts with (`text%`) | ends with (`%text`) |
| `~text~` | — | contains (`%text%`) |

**v1 clients sending `~text` change meaning from starts-with to
ends-with.** Rewrite them to `text~` (or move to typed
[condition helpers](/guide/build#condition-helpers) / the
[expression dialect](/integrations/url#expression-dialect), which have
no positional magic).

### Expression dialect: quoted values are never comma-split

`eq(name, 'a,b')` now parses to the plain string `'a,b'`. Lists are
expressed as separate arguments (`in(status, 'a', 'b')`), not comma
strings.

## Codecs

### Loud failures instead of silent lossiness (breaking)

v1's URL build silently emitted whatever it was given. v2's `encode`
throws typed errors (`FEATURE_UNSUPPORTED`, `OPERATOR_UNSUPPORTED`)
for queries the wire dialect cannot represent — nested compounds,
`or(...)`, same-field conditions, regex/mod/exists/elemMatch, values
that would re-parse as a different condition. See the
[round-trip guarantee](/integrations/url#the-round-trip-guarantee).

## Server pipeline

### Strict mode is opt-in

typeorm-extension rejected parameters without an allow-list; v2
permits them unless `strict` is enabled (schema- or parse-level).
Security-sensitive consumers should enable it when migrating.

### TypeORM joins default to LEFT

typeorm-extension used inner joins for relations; `@rapiq/typeorm`
defaults to left joins (override per relation via the adapter's
`onJoin` hook).

# tada5hi/typeorm-extension (rapiq v1 server integration layer)

The de-facto v1 server-side integration: both authup and PrivateAIM/hub call rapiq almost exclusively *through* `applyQuery`/`apply*` from this library. **@rapiq/typeorm is its successor** — its behavior is the compatibility baseline. Source read first-hand 2026-06-10 (`/tmp/rapiq-consumers/typeorm-extension/src/query/`).

## Mapping to this repo

| typeorm-extension | What it does | rapiq v2 counterpart |
|---|---|---|
| `src/query/module.ts` `applyQuery(qb, input, options)` | `parseQuery` (rapiq v1) + apply each parse output to the query builder; returns parse output incl. pagination | SimpleParser.parse → `Query.accept(QueryVisitor)` → `TypeormAdapter.execute()` |
| `src/query/parameter/filters/module.ts` `transformParsedFilters` | v1 `FiltersParseOutput` (FLAT array of `{key, path, operator, value}`) → `{statement, binding}` list | @rapiq/sql `FiltersVisitor` + `FiltersBaseAdapter` |
| `applyFiltersTransformed` | one `Brackets` with `andWhere` per condition — **AND-only, no OR trees in v1** | v2 `Filters` compound (and/or) — strictly more expressive |
| `src/query/parameter/relations/module.ts` | `leftJoinAndSelect` per relation + `onJoin(key, alias, qb)` hook; nested keys via `parts.slice(-2)` | @rapiq/typeorm `RelationsAdapter` (currently `innerJoinAndSelect` — **join-type divergence**, see below) |
| `src/query/parameter/fields/module.ts` + `src/query/utils/alias.ts` | `query.select(fields.map(...))` with alias resolved per field via `getAliasForPath(relationsOutput, field.path)` | @rapiq/typeorm `FieldsAdapter` + shared `RelationsAdapter` (same cross-parameter alias idea) |
| `bindingKey?: (key) => string` option | customizable parameter binding names (`filter_user_id`) | no v2 equivalent (placeholder indexer only) |

## Behavioral facts @rapiq/typeorm must reckon with (migration contract)

1. **Secure-by-default opt-out**: `applyQuery` sets `options.fields/filters/relations/sort = false` (parameter fully disabled) unless `allowed`/`default` is explicitly defined (`isQueryOptionDefined`). rapiq v2 schemas treat *undefined* `allowed` as "any syntactically valid property" — **less restrictive**. Migrating consumers who omit a parameter's schema would silently open it up. v2 needs either matching opt-out semantics or a loud migration callout.
2. **Null semantics live in the adapter**: `value === null` → `IS NULL` / `IS NOT NULL`; a `null` inside an IN-array is spliced out and rewritten as `(key IN (...) OR key IS NULL)` (AND/NOT variant for NOT_IN). This is what makes authup's `filter: { realm_id: [id, null] }` realm-scoping pattern work. v2's sql/typeorm filter visitors must implement equivalent null handling or the single most common consumer filter breaks.
3. **v1 `~` LIKE is starts-with**: `transformParsedFilters` appends only a trailing `%` (`filter.value += '%'`). Client `~text` therefore means `text%`. v2's distinct STARTS_WITH/CONTAINS operators are richer, but codec/migration mapping of `~` must preserve starts-with semantics.
4. **Join type**: relations are applied with `leftJoinAndSelect`; current @rapiq/typeorm `RelationsAdapter` uses `innerJoinAndSelect`/`innerJoin` — inner joins drop rows with absent relations, a silent result-set change for every migrated endpoint.
5. **`onJoin` hook**: consumers (8+ hub repos, all authup repos) rely on it to `addGroupBy(`${alias}.id`)` because their root queries use `groupBy`. No v2 equivalent yet.
6. **Pagination is echoed back**: `applyQuery` returns the parse output; consumers destructure `{ pagination }` for response `meta`. v2 `execute()` currently returns nothing.

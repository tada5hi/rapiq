# PrivateAIM/hub (rapiq consumer)

Federated-analytics platform with multiple backend services (core, storage, telemetry). Uses rapiq **v1 (0.9)** in 66 files (~95 imports) plus typeorm-extension. The most architecturally diverse consumer: TypeORM backends *and* a non-SQL log store. Investigated 2026-06-10 from a shallow clone.

## Usage map (v1 → rapiq v2 equivalent)

| hub code | v1 API used | v2 equivalent |
|---|---|---|
| `packages/core-http-kit/src/domains/*/module.ts` (~20 entity APIs: `getMany(record?: BuildInput<T>)` → `` get(`projects${buildQuery(record)}`) ``) | `BuildInput<T>`, `buildQuery()` | `QueryBuilder` + `URLEncoder` |
| `packages/client-vue/src/core/list/module.ts` (generic list composable; merges input/pagination-state/context-query/props-query with `smob.createMerger`; `queryFilters` mutation callback) | `BuildInput`, `FiltersBuildInput` | needs typed merge (plan 010) |
| `packages/client-vue/src/core/entity-manager/module.ts:294-404` (spread-composes `query`/`queryFields`/`queryFilters` props `as any`) | per-parameter build inputs | composite-input assignability (plan 010) |
| `packages/client-vue/src/core/query/sort.ts` (`isQuerySortedDescByDate` inspects `SortBuildInput` string `-created_at` / object forms for realtime prepend decisions) | `SortBuildInput`, `SortDirection` | v2 `Sorts`/`Sort` AST makes this introspection trivial — but only if clients hold a `Query`, not a raw object |
| `apps/server-core/.../repositories/*/repository.ts` — **two generations**: 8 repos with granular `parseQueryFields` + `applyQueryFieldsParseOutput` + `applyRelations`/`applySort`/`applyFilters`/`applyPagination`; 5 repos with monolithic `applyQuery` | v1 parse + typeorm-extension | `defineSchema` + parser + @rapiq/typeorm |
| `apps/server-core/.../controllers/entities/analysis-node-log/module.ts` | `parseQuery` with allow-list → normalize filters → **rebuild** a `FiltersBuildInput<Log>` for the downstream telemetry client | parse → transform AST → re-encode: exactly the v2 codec round-trip pipeline (plans 007 + 010) |
| `apps/server-telemetry/.../controllers/log/module.ts` | only `parseQueryPagination`; filters parsed **by hand** into Prometheus/Loki-style `labels` because no SQL backend | v2 Query AST + custom visitor — the flagship non-SQL use case |
| `apps/server-storage/.../repositories/{bucket,bucket-file}` | `applyQuery` | @rapiq/typeorm |

## Behavioral observations

- **Gateway pattern**: hub's core service acts as a query *proxy* — it parses a client query, validates against an allow-list, transforms field names/shape, and emits a *new* query to another rapiq-speaking service. v1 makes this awkward (ParseOutput ≠ BuildInput); v2's symmetric `Query` AST + encoder is the right shape, provided codec round-trip is complete (plan 007).
- **Non-TypeORM backend exists today** (telemetry log store): proof that v2's backend-agnostic AST/visitor split has a real consumer. They need: walk parsed `Filters` into `Record<string, string>` labels + pagination. A ~30-line custom `IFiltersVisitor` would replace their hand-rolled key-splitting loop.
- **`onJoin` → `addGroupBy` boilerplate** repeated 8+ times (same as authup); forgetting it breaks `getManyAndCount`. v2 typeorm adapter needs join hooks or automatic groupBy handling (plan 004/010).
- **Two repo generations** (granular apply-* vs monolithic applyQuery) show consumers want *both* granularities: whole-query convenience plus per-parameter escape hatches. v2 parsers already expose per-parameter `parse*`; keep both levels public.
- **`ParseAllowedOption<T>`** used to type shared `DEFAULT_FIELDS` constants — consumers want exported types for schema fragments, not only `defineSchema` inline literals.

## What hub needs from v2 (evidence-based)

1. Query AST consumable by non-SQL backends + a documented "write your own visitor" guide (telemetry).
2. Complete, lossless parse↔encode round-trip for the gateway/proxy pattern (analysis-node-log).
3. typeorm adapter parity incl. join/groupBy hooks (13 repositories).
4. Typed merge + composable build input for the Vue list/entity-manager kits.
5. Shareable schema definitions to replace per-repo allow-list duplication.

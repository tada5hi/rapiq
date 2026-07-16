# authup/authup (rapiq consumer)

Peter's auth service. Uses rapiq **v1 (0.9)** in 43 files (63 direct call sites) plus typeorm-extension (34 call sites) as the actual server-side integration layer. Investigated 2026-06-10 from a shallow clone.

## Usage map (v1 → rapiq v2 equivalent)

| authup code | v1 API used | v2 equivalent |
|---|---|---|
| `packages/core-http-kit/src/domains/entities/*/module.ts` (21 entity APIs, identical shape: `getMany(options?: BuildInput<T>)` → `` this.client.get(`users${buildQuery(options)}`) ``) | `BuildInput<T>`, `buildQuery()` | `defineQuery()` + `createURLCodec().encode()` (`@rapiq/codec-url`) |
| `packages/client-web-kit/src/components/utility/entity/collection/module.ts` (list composable; merges 4 query sources via `smob.createMerger({ priority: 'left' })`) | `BuildInput`, manual deep-merge | no v2 equivalent yet — needs typed Query/BuildInput merge (plan 010) |
| `packages/client-web-kit/.../entity/record/module.ts:322-330` (`(query as any).filters = ctx.props.queryFilters` — casts to compose BuildInput parts) | `FiltersBuildInput`/`FieldsBuildInput` type mismatch | v2 must make per-parameter inputs assignable to the composite input |
| `packages/client-web-kit/.../search/module.ts:67-76` (`filters: { name: `~${text}` }`) and `ACompositePolicyForm.vue` (`filters.id = [`!${id1}`, `!${id2}`]`) | operators as magic string prefixes (`~`, `!`), arrays-as-OR, `null` in arrays | v2 simple dialect `{ $contains: text }`-style operator objects; client builder needs the same typed operators |
| `apps/server-core/src/app/modules/database/repositories/*/repository.ts` (21 repos; `applyQuery(qb, query, { defaultAlias, fields: { default, allowed }, filters: { allowed }, pagination: { maxLimit: 50 }, relations: { allowed, onJoin: addGroupBy }, sort: { allowed } })`) | typeorm-extension `applyQuery` (wraps v1 parse) | `defineSchema` + `SchemaRegistry` + SimpleParser + @rapiq/typeorm adapter |
| `packages/server-kit` | `PaginationParseOutput` (`{ limit, offset }` meta echoed in responses) | v2 `IPagination` |

## Behavioral observations

- **Allow-lists are repeated per repository**, never shared — v2 `SchemaRegistry` directly addresses this; authup would define one schema per entity and register once.
- **`fields: { default: [...], allowed: ['email'] }`** — sensitive-field opt-in pattern (email hidden by default). v2 FieldsSchema supports default+allowed; keep this semantic.
- **`relations.onJoin` is used solely to `addGroupBy(`${key}.id`)`** because repos use `qb.groupBy(...)` — v2 @rapiq/typeorm has no join hook yet (gap, plan 004/010).
- **Permission gating happens before the query** (service `preEvaluate` then untouched pass-through); realm scoping is done by the *client* sending `filter: { realm_id: [id, null] }`. Server-enforced scoping would need parsed-Query manipulation (AND-merge injected conditions) — v2 AST enables this; no v1 equivalent existed.
- **maxLimit: 50 everywhere** — v2 `PaginationSchema.maxLimit` exists ✓.

## What authup needs from v2 (evidence-based)

1. Composable typed build input (kill the 4 `as any` casts in client-web-kit).
2. First-class query merge with documented precedence (replace smob).
3. Typed filter operators on the client (replace `~`/`!` string-prefix magic).
4. Schema reuse across endpoints (v2 registry ✓ — needs migration docs).
5. typeorm adapter parity with typeorm-extension: defaultAlias, join hooks/groupBy, fields default+allowed semantics, pagination meta output.

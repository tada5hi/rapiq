# Migration from typeorm-extension

`@rapiq/typeorm` succeeds typeorm-extension's `applyQuery`/`applyQueryParseOutput` pipeline. The contract is deliberately close — but a few defaults flipped, and the ones that did are security-relevant.

## API mapping

| typeorm-extension | rapiq v2 |
|---|---|
| `applyQuery(qb, req.query, options)` | `decoder.decode(req.query, { schema })` + `new TypeormAdapter({ queryBuilder: qb }).execute(query)` — see the [Express recipe](/guide/recipes/express-typeorm) |
| per-call `allowed`/`default` options | a named [`Schema`](/guide/schemas) in a `SchemaRegistry` |
| returned parse output (pagination) | `adapter.execute(query)` returns the applied pagination |
| `relations.onJoin` hook | `relations.onJoin` on the [adapter options](/packages/typeorm#options) |

## Behavior differences

### Parameters without an allow-list are open (breaking, security-relevant)

typeorm-extension **disables** any parameter whose `allowed`/`default` options are missing. rapiq's default is the opposite: a parameter without an allow-list accepts any syntactically valid key.

Enable [`strict: true`](/guide/schemas#strict-mode) on your schemas to keep the closed-by-default semantics when migrating:

```typescript
defineSchema<User>({
    name: 'user',
    strict: true,                          // reject undeclared parameters
    filters: { allowed: ['id', 'name'] },
});
```

### Joins default to LEFT

typeorm-extension used inner joins for relations; `@rapiq/typeorm` defaults to **left** joins, keeping records whose relation is absent. Restore inner joins per adapter via `relations: { joinType: 'inner' }`.

### Join aliases are path-qualified

typeorm-extension aliased joins by the relation path's **last segment** (`role.realm` joined as `realm`), so relation paths ending in the same segment collided. `@rapiq/typeorm` aliases by the **full path** with `.` replaced by `_` (`role.realm` → `role_realm`) — see the [alias convention](/packages/typeorm#options). This only surfaces in code that references join aliases directly, e.g. hand-written `andWhere` clauses on nested relations; `onJoin` hooks keep working unchanged, since the `alias` argument they receive is already path-qualified. A custom derivation can be injected via `relations: { relationAlias }`, but it must stay collision-free.

### Defaults that carried over

- `joinAndSelect` behavior matches `leftJoinAndSelect` — set `relations: { joinAndSelect: true }`.
- `execute` returns the applied pagination, mirroring `applyQuery`'s parse-output contract.

## Suggested migration path

1. Model each resource's per-call options as a [`Schema`](/guide/schemas) with `strict: true`.
2. Replace `applyQuery` call sites with decode → execute (the [recipe](/guide/recipes/express-typeorm) is the template).
3. If your code relied on inner-join semantics, set `joinType: 'inner'`.
4. Turn on `throwOnFailure` where you want contract violations to become `400`s instead of silent drops.

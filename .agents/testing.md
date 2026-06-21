# Testing

## Setup

- **Runner**: Vitest 4 (native TS via Vite/esbuild, no transform config needed)
- **Test location**: `packages/<pkg>/test/unit/**/*.spec.ts`
- **Config**: `packages/<pkg>/test/vitest.config.ts` (one per package; `globals: true`, v8 coverage)
- **Fixtures**: `packages/<pkg>/test/data/` (shared schemas, record types)

## Running Tests

```bash
npm run test                                      # all packages via nx run-many
npm run test --workspace=packages/core            # single package
npm run test --workspace=packages/core -- -t "filters"   # filter by test name
npm run test:coverage --workspace=packages/core   # with coverage
```

Vitest sets `NODE_ENV=test` automatically. Nx caches `test` targets — pass `--skip-nx-cache` to `npx nx run-many -t test` if you suspect stale results.

## Test Layers

### Unit Tests

The only layer — there are no integration tests and no external infrastructure (no databases, no Docker). Even `@rapiq/typeorm` is tested against TypeORM's `SelectQueryBuilder` API without a live database.

Specs typically `describe` the module under test by source path:

```typescript
describe('src/utils/*.ts', () => {
    it('should expand object paths', () => { ... });
});
```

## Test Helpers & Fixtures

- `test/data/type.ts` — shared record types (`User`, `Realm`, `Item`) used as the generic `RECORD` in schemas and parsers.
- `test/data/schema.ts` — `defineSchema<User>(...)` fixtures plus a populated `SchemaRegistry`; parser tests import these instead of redefining schemas inline.
- Parser specs instantiate the real parser classes with the fixture registry — no mocking of core classes.

## Testing Philosophy

Tests should assert *expected* behavior based on the documented query semantics (JSON-API style parameters, schema allow-lists) — not merely confirm what the implementation currently does. If a test fails, it may surface a real bug rather than a test error.

**Prefer real instances over mocks.** Core classes (`Query`, `Schema`, `SchemaRegistry`, parsers, adapters) are cheap to construct; build real object graphs from `test/data/` fixtures instead of using `vi.fn()` / `vi.mock()`. Globals (`describe`/`it`/`expect`/`vi`) are enabled via `globals: true`, so specs need no imports from `vitest`.

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`) on pushes/PRs to `develop`, `master`, `next`, `beta`, `alpha`:

1. **install** (Node 22, shared composite action `.github/actions/install`)
2. **build** (`.github/actions/build`, Nx dependency-ordered)
3. **test** and **lint** as separate jobs (after build)

Coverage is reported to Codecov.

## Writing New Tests

1. Place spec files in `packages/<pkg>/test/unit/` with the `.spec.ts` extension (mirror the `src/` subdirectory you're testing).
2. Reuse or extend the fixtures in `test/data/` rather than defining one-off schemas.
3. Run `npm run test --workspace=packages/<pkg>` to verify.

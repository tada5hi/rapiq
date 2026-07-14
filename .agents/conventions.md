# Conventions

## Tooling

| Tool            | Purpose                                                              |
|-----------------|----------------------------------------------------------------------|
| Nx 22           | Task orchestration & caching (`build`, `test`, `lint`; build depends on `^build`) |
| tsdown 0.22     | Bundle + dts per package (`build:js`); ESM-only `dist/index.mjs` + `dist/index.d.mts`; per-package `tsdown.config.ts` |
| tsc 6           | Type-check only (`--noEmit`, `build:types`, src-scoped `tsconfig.build.json` per package) |
| ESLint 10       | Flat config (`eslint.config.mjs`) via `@tada5hi/eslint-config` + `typescript-eslint` |
| Vitest 4        | Tests (see [testing.md](testing.md))                                 |
| husky           | `commit-msg` hook runs commitlint                                   |
| release-please  | Automated versioning/changelogs (workspaces plugin, updates peer deps) |
| pkg-pr-new      | Preview package publishing for PRs                                   |

## Workflow

- After making changes, **build the affected package** (`npx nx run @rapiq/<pkg>:build`) and **run the linter** on changed files. Remember Nx builds dependents from `dist/`, so a stale `@rapiq/core` build breaks downstream type-checking.
- When changing `@rapiq/core` public API, check all downstream packages (parser-simple, parser-expression, sql, typeorm, codec-url-simple) — they peer-depend on it.
- User-facing behavior changes should be reflected in `packages/docs/guide/` and, if relevant, the root `README.md`.

## Code Style

- **Module format**: ESM source; ESM-only build output (`"type": "module"`, no CJS).
- **Indentation**: 4 spaces.
- **Linting**: `@tada5hi/eslint-config` (flat); locally disabled rules: `class-methods-use-this`, `no-continue`, `no-shadow`, `no-use-before-define`, `no-useless-constructor` (see root `eslint.config.mjs`).
- Every source file starts with the copyright header block (copy it from a neighboring file).

## Naming Conventions

| Pattern | When to use | Examples |
|---------|-------------|----------|
| `I*` interface prefix | Behavioral contracts implemented by classes | `IQuery`, `IFilterVisitor`, `IRootAdapter` |
| Plural/singular class pairs | Collection node vs single record node | `Filters`/`Filter`, `Sorts`/`Sort`, `Fields`/`Field` |
| `define*` factories | Public construction helpers returning class instances | `defineSchema`, `defineFieldsSchema` |
| `Base*` | Abstract shared base classes | `BaseParser`, `BaseSchema`, `BaseError` |
| Dialect/backend prefix | Per-package implementations of core interfaces | `SimpleFiltersParser`, `ExpressionParser`, `TypeormAdapter` |
| UPPER_SNAKE const objects | Enum-like constants (`as const` objects + derived types) | `FilterFieldOperator`, `SortDirection`, `Parameter`, `URLParameter` |

## File Organization

- Exported **types** (interfaces, type aliases) live in a `types.ts` next to the implementation; constants in `constants.ts`; main implementation in `module.ts`.
- Barrel `index.ts` files re-export from `types.ts`, `constants.ts`, and `module.ts`; the package's public API is whatever `src/index.ts` re-exports.
- Per-parameter code is split into `{fields,filters,pagination,relations,sorts}/` directories — keep new parameter logic in the matching directory across all packages.

## Git Hooks

Husky runs a single hook:

- **commitlint** (`commit-msg` hook) — validates Conventional Commits format via `@tada5hi/commitlint-config` (`commitlint.config.mjs`)

## Commit Convention

Commits follow **Conventional Commits** (angular preset):

```
feat(core): add elemMatch filter operator
fix: make query properties readonly
chore: update release-please configuration
```

No AI-attribution trailers in commits, issues, or PRs (see AGENTS.md).

## TypeScript

- Base config from `@tada5hi/tsconfig`. Per package: `tsconfig.json` (src + test, includes `vitest/globals` types — for editor & ESLint) and `tsconfig.build.json` (src-only — used by `build:types`' `tsc --noEmit` and by tsdown).
- Heavy use of recursive conditional types for typed key paths (`NestedKeys<T>`, depth-limited to avoid infinite recursion) — be careful when touching `packages/core/src/types.ts`; small changes can explode type-check time.
- TypeScript 6 at the root.

## Build Output

- Each package builds to `dist/`: `index.mjs` (ESM) + `index.d.mts` (types) — ESM-only, wired via the `exports` map (`import` + `types` conditions) in each `package.json`.
- Per package, `build` = `build:types` (`tsc --noEmit`) then `build:js` (`tsdown`). `npm run build` (root) = `npx nx run-many -t build`; `prepublishOnly` rebuilds per package.

## Release Process

- **release-please** (`release-please-config.json`, manifest-driven) manages all ten public workspaces as one linked version group. It is currently in `prerelease: true` / `beta` mode, emits component-qualified tags, and updates internal peer dependency ranges through the node-workspace plugin.
- `release-as: 2.0.0-beta.0` bootstraps the first v2 beta. Remove that one-time override immediately after the beta release PR is merged so subsequent betas increment normally.
- Every public package publishes with npm access `public` and dist-tag `beta`; a prerelease must never update npm's `latest` tag.
- The private `@rapiq/docs` workspace keeps its internal `@rapiq/*` build inputs in `devDependencies` with `*` ranges. This ensures clean installs always link the current workspaces across major/prerelease bumps without adding docs tooling to the production audit.
- Release workflow: `.github/workflows/release.yml` runs on `master`. After release-please creates releases it installs, builds, lints, runs coverage, uploads coverage, and only then publishes. General CI runs on `develop`, `master`, `next`, `beta`, `alpha`.
- Do not bump versions or edit `CHANGELOG.md` manually.

## References

External project references live in `.agents/references/` — one Markdown file per external project (e.g. `.agents/references/typeorm.md`). When looking up source code in a referenced project (TypeORM, qs, pathtrace, smob), update the corresponding reference file with:

- The source file path / function name in the external project
- The corresponding file path / function name in this project
- Any behavioral differences between the implementations

This builds a cumulative mapping over time so future work can quickly find corresponding code without re-searching.

## Documentation Site

| Change | Docs to update |
|--------|----------------|
| Parameter syntax/semantics (fields, filters, sort, …) | `packages/docs/guide/` API reference pages |
| New package or export | `packages/docs/guide/` + root `README.md` |

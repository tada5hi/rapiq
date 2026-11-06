# rapiq — Agent Guide

Rapiq (**R**est **Api** **Q**uery) is a TypeScript library to build an efficient interface between client- & server-side applications. It defines a scheme for the request query (fields, filters, relations, pagination, sort — based on the [JSON-API](https://jsonapi.org/format/) spec), but **not** for the response. This repository is the **v2 monorepo**: the former single `rapiq` package is split into focused, composable `@rapiq/*` packages (core AST + schema, parsers, codecs, SQL/TypeORM adapters).

## Quick Reference

```bash
# Setup
npm install

# Development
npm run build                 # nx run-many -t build (all packages, dependency-ordered)
npm run test                  # nx run-many -t test (all packages)
npm run lint                  # eslint (flat config, whole monorepo)
npm run lint:fix

# Per package (from repo root)
npx nx run @rapiq/core:build
npm run test --workspace=packages/core
```

- **Development Node.js**: 24.11+ on the 24.x line, or 26+ (CI runs on 24). Published runtime requirements are declared in each package manifest.
- **Package manager**: npm (workspaces: `packages/*`)
- **Build orchestration**: Nx (`build` depends on `^build`; `build`, `lint`, `test` are cached)
- **Per-package build**: `tsc --noEmit` (type-check, `build:types`) + tsdown (bundle + dts, `build:js`); ESM-only output (`dist/index.mjs` + `dist/index.d.mts`)

All publishable packages live in `packages/`; `packages/docs` is the VitePress documentation site.

## Documentation

The `packages/docs` directory contains the VitePress documentation site (published at https://rapiq.tada5hi.net). When making changes that affect user-facing behavior or APIs, **update the corresponding docs pages** in `packages/docs/guide/`.

```bash
npm run dev --workspace=packages/docs     # run the docs site locally
npm run build --workspace=packages/docs   # build the docs site
```

Note: the root `README.md` documents v2; v1 lives on the `v1` branch.

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Package inventory, dependency layers, and per-package source layout
- **[Architecture](.agents/architecture.md)** — Query AST, visitor pattern, schema system, parser dialects, and backend adapters
- **[Testing](.agents/testing.md)** — vitest setup, per-package configs, and test data conventions
- **[Conventions](.agents/conventions.md)** — Linting, file organization, commit format, and release process

### Writing agent docs

Keep the guides factual and focused on contracts a future change could silently break.

- Keep existing commands, paths and factual descriptions current. Add guide content only for an invariant or cross-cutting rule. Put defect stories and verification details in the PR, and user-facing changes in the documentation site or release notes.
- Keep subsystem detail in `.agents/topics/` and link it from the relevant guide; do not import topic files into `CLAUDE.md`.
- Describe current behavior and cite issues or PRs, rather than local plan files or a running history of completed work.
- `npm run lint` enforces the shared config's agent-doc size, import-budget and history checks. Preserve the critical contracts when splitting a guide.

## Commits, Issues & Pull Requests

- Branch model: PRs usually target `develop` (current work happens on `master`/`develop`; release branches: `master`, `next`, `beta`, `alpha`).
- Commits follow Conventional Commits, enforced by commitlint (husky `commit-msg` hook).
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.

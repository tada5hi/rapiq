# node-rs

- **Repo**: https://github.com/napi-rs/node-rs (reviewed at `b706e30`, 2026-10-06)
- **Relevance**: napi-rs's own monorepo of Rust-backed npm packages
  (`@node-rs/argon2`, `bcrypt`, `crc32`, `jieba`, `jsonwebtoken`, `xxhash`).
  The reference for how each npm package owns its native addon, which is
  rapiq's choice (R7 in `internal-docs/rust/DECISIONS.md`). Nothing is
  imported from it.

## Structure

- `packages/<name>/` is both the npm package and its napi crate:
  `package.json`, `Cargo.toml` (crate `node-rs_<name>`, `cdylib`, version
  `0.0.0`, not on crates.io), `build.rs`, `src/lib.rs`, `__test__/`,
  `benchmark/`. Pure-JS packages (`packages/helper`) sit beside them with
  only `package.json` and `src/`. No ecosystem level: Node is their only one.
- Cargo members list the packages explicitly plus `crates/alloc`, a shared
  `global_alloc` crate that installs mimalloc (`mimalloc-safe`) in every
  binding. Versions live in `[workspace.dependencies]`; the release profile
  uses `lto = true`, `codegen-units = 1`, `strip = 'symbols'`.
- Each package's `package.json` has a `napi` block (`binaryName`, `targets`
  including `wasm32-wasip1-threads`, `wasm.browser` options). Scripts:
  `build` (a `build.ts` using `@napi-rs/cli`'s programmatic API to toggle
  features per target, e.g. no `parallel` on WASM), `artifacts`
  (`napi artifacts -d ../../artifacts`), `prepublishOnly: napi prepublish`,
  `version: napi version`.
- Generated and committed: `index.js` (platform loader, glibc vs musl
  detection), `index.d.ts` (types from `#[napi]` signatures), `browser.js`
  (`export * from '@node-rs/<name>-wasm32-wasi'`), `*.wasi.cjs`,
  `*.wasi-browser.js`, `wasi-worker*.mjs`. Not committed: `npm/` (gitignored),
  created in CI by `napi create-npm-dirs`.
- `files` publishes only the loader, types and browser entry; the binary
  comes from the platform package (`@node-rs/<name>-<platform>`).
- **Factory over binding** (`packages/bcrypt`): `api.cjs` exports
  `createBcrypt(binding)`; `index.js` calls it with `require('./binding')`,
  `browser-entry.js` with `@node-rs/bcrypt-wasm32-wasi`; `exports` selects
  them with a `browser` condition. Comment in `browser-entry.js`: "Keep the
  public adapter separate from browser.js, which napi build regenerates."
- CI (`.github/workflows/ci.yaml`): one `build` job per target that builds
  every package for that target and uploads `bindings-<target>`; test jobs
  per platform (Docker images for musl, ARM; Node 22 and 24; `test-wasi-nodejs`);
  a `publish` job that downloads all artifacts, runs `create-npm-dirs` and
  `artifacts`, builds TS and publishes with npm provenance (`id-token: write`).
- Versioning: lerna, independent versions per package.

## Mapping to rapiq

| node-rs | rapiq | Difference |
|---------|-------|------------|
| `packages/<name>/` = npm package + crate | `packages/<package>/node` (npm) with the crate in `node/binding` | rapiq's `src/` is a large TS tree, so the crate gets its own directory |
| `crates/alloc` (mimalloc) | `packages/binding-support/rust` (P4) | also holds the JSON boundary and error conversion |
| `napi` block + `napi create-npm-dirs` / `artifacts` / `prepublish` | P1 | adopt |
| committed `index.js` / `index.d.ts` | P2 | ESM loader variant |
| bcrypt's `api.cjs` + `index.js` / `browser-entry.js` | P3 (`src/module.ts`, `src/index.ts`, `src/browser.ts`) | adopt |
| build per target, test per platform, one publish job | P5 | adopt |
| lerna independent versions | release-please linked versions | rapiq packages move in lockstep (D6) |

## `@napi-rs/cli` 3.10.8 publish commands (read 2026-10-09)

Source: `node_modules/@napi-rs/cli/dist/cli.js` (`collectArtifactsUnlocked`,
`prePublish`, `planThreadlessWasiRootFacade`). Used by rapiq's
`.github/workflows/release.yml`.

- `napi create-npm-dirs --npm-dir npm`: one directory per target with a
  generated `package.json` (name `<packageName>-<platformArchABI>`, `os`,
  `cpu`, `libc`, `publishConfig.access` only, no `tag`). The `wasm32-wasip1`
  package has no `cpu`/`os` and depends on `@napi-rs/wasm-runtime` and the
  emnapi packages.
- `napi artifacts --output-dir artifacts --npm-dir npm`: copies every
  `<binaryName>.<platformArchABI>.node|.wasm` into its npm directory AND into
  the package root, copies the WASI glue (`*.wasip1.cjs`, `-browser.js`,
  `-deferred.js` and their declarations) from the artifact directory, writes
  a root `browser.js`, and requires the loader the WASI metadata names
  (`--js index.cjs`) beside the artifacts or in the package root. rapiq's
  loader lives in `binding/`, so the release copies it into `artifacts/`.
  It tolerates a `*.debug.wasm` beside the artifacts.
- `napi pre-publish --npm-dir npm --tag-style npm --no-gh-release`: validates
  each platform package with `npm pack --dry-run`, runs a plain
  `npm publish` in a staged copy of each (so `NPM_CONFIG_TAG` selects the
  dist-tag; "cannot publish over the previously published versions" is
  skipped, so a re-run is safe), and rewrites the root `package.json`:
  `optionalDependencies` for the native targets only (not the WASM package),
  plus, for a threadless WASI target, a "root facade" (`./workerd`, `./wasm`,
  `./wasm.wasm` exports, the `.wasm` copied into the root and added to
  `files`). There is no switch for the facade. `--dry-run` touches nothing
  and publishes nothing, so it verifies little; to test the real path, put a
  stub `npm` that swallows `publish` first in `PATH`.

Differences from rapiq's usage: node-rs commits `browser.js` and the WASI
glue in the package root; rapiq generates them into `binding/` and keeps
them out of git, and uploads them from the CI `wasm` job.

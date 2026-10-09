# rolldown

- **Repo**: https://github.com/rolldown/rolldown (reviewed at `24bc2d0`, 2026-10-09)
- **Relevance**: the reference for a Rust core with a TypeScript API shipped
  through napi-rs, pnpm and Cargo workspaces. Informs rapiq's Rust migration
  (`internal-docs/rust/`); nothing is imported from it.

## Structure

- Two trees: `crates/` holds every Rust crate (`rolldown`, `rolldown_common`,
  `rolldown_plugin_*`, ...), `packages/` every npm package (`rolldown`,
  `browser`, `debug`, test packages). Cargo `members = ["./crates/*", "tasks/*"]`.
- **One binding crate** for the whole project: `crates/rolldown_binding`
  (`crate-type = ["lib", "cdylib"]`, `publish = false`) aggregates every crate
  into a single addon.
- The npm package `packages/rolldown` carries the `napi` block in its
  `package.json` (`binaryName: rolldown-binding`, `packageName:
  @rolldown/binding`, 16 targets including `wasm32-wasip1-threads`, `wasm`
  options with a browser `asyncInit`). Platform packages
  `@rolldown/binding-<target>` are produced by `napi artifacts` into
  `packages/rolldown/npm/` and published by `napi pre-publish`.
- The generated loader is committed as `packages/rolldown/src/binding.cjs`
  (+ `binding.d.cts`, `rolldown-binding.wasi.cjs`): CommonJS even though the
  package is ESM. It also checks that the installed platform package's
  version equals the loader's, and has a WebContainer fallback
  (`webcontainer-fallback.cjs`).
- `@rolldown/browser` (`packages/browser`) is the WASM build for browsers.
- `rust-toolchain.toml` pins the channel; `[workspace.lints]` (clippy groups,
  `dbg_macro`/`todo`/`print_stdout` denied) and `[workspace.dependencies]`
  are centralized; `justfile` drives common tasks.

## Mapping to rapiq

| rolldown | rapiq | Difference |
|----------|-------|------------|
| `crates/` + `packages/` trees | `packages/<package>/{rust,node,python}` | rapiq groups by package first (R5 in `internal-docs/rust/DECISIONS.md`) |
| `crates/rolldown_binding` (one addon) | `packages/<package>/node/binding` (one addon per package) | deliberate (R7): package independence over binary size |
| `napi` block in `packages/rolldown/package.json` | `napi` block in each Rust-backed npm package (P1) | same mechanism, per package |
| committed `src/binding.cjs` loader | committed generated loader (P2) | rapiq wants the ESM variant |
| loader version check against the platform package | adopt with P1/P2 | catches a stale platform package after an upgrade |
| `wasm32-wasip1-threads` + `@rolldown/browser` | candidate for the WASM fallback (D2) | needs `SharedArrayBuffer` (cross-origin isolation) in browsers |
| `[workspace.lints]`, `[workspace.dependencies]`, `rust-toolchain.toml` | P6 | adopt as is |

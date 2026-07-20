# pathtrace

- **Repo**: https://github.com/tada5hi/pathtrace (tada5hi utility)
- **Used by**: `@rapiq/core` (dependency `pathtrace@^1`)

Object key-path utilities used by core for nested field/relation path handling.

## Code Mappings

Surveyed 2026-07-20 (pathtrace 2.2.0, local checkout `/opt/projects/tada5hi/pathtrace`, branch `141-cve`).

pathtrace exports (`src/index.ts`): `getPathValue`, `setPathValue`, `getPathInfo`/`PathInfo`, `expandPath` (`*`/`**` wildcards), `removePath`, `pathToArray`/`arrayToPath`, and the type `Path<T, Depth = 4>` (dotted + `[index]` bracket + wildcard path union). `utils/` (`isObject`, `isUnsafeKey`) is **internal**, not exported.

| pathtrace | rapiq | Behavioral differences |
|---|---|---|
| `setPathValue` | `packages/core/src/parser/base.ts` (`BaseParser.expandObject`) | Only current integration point; used to expand `a.b` input keys into nested objects. |
| `getPathValue` (`path-value/get.ts`) | `packages/memory/src/helpers/value.ts` (`resolveProperty`/`resolvePath`) | Deliberately NOT interchangeable: memory resolves **own properties only** (pathtrace uses `in Object(x)`, walking the prototype chain, guarded by `isUnsafeKey`), null-unifies `undefined`→`null`, and resolves arrays-on-path to absent because array fan-out (same-element join-row binding) is owned by `packages/memory/src/parameter/filters/binding.ts` (plan 014 contract). Memory paths never use `[index]` brackets. |
| `Path<T, Depth=4>` (`types.ts`) | `packages/core/src/types.ts` (`SimpleKeys`/`NestedKeys`/`SimpleResourceKeys`/`NestedResourceKeys`/`TypeFromNestedKeyPath`, depth 5) | Different grammar and semantics: rapiq is dotted-only JSON-API style (arrays flatten to `items.title`, no brackets/wildcards), splits leaf keys (columns) from branch/resource keys (relations), unwraps `null`/`undefined` and treats index-signature records (JSON columns) as non-recursing leaves (PR #785), and resolves value types via `TypeFromNestedKeyPath`. pathtrace's `Path` has none of these distinctions. |
| `utils/is-object.ts` (internal) | `packages/core/src/utils/object.ts` (`isObject`, exported) | Duplicate concept; pathtrace's is not exported, so core keeps its own. |
| — | `packages/core/src/utils/key.ts` (`parseKey`/`stringifyKey`), `mapping.ts` (`applyMapping`) | No pathtrace counterpart: rapiq wire grammar (`[group:][path.]name`) and longest-match dotted alias rewriting are domain-specific. |

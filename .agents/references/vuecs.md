# vuecs

Reference implementation for the marketing-hero documentation landing pattern
(see `.agents/plans/003-marketing-hero-pattern.md`). Local checkout: `/opt/projects/tada5hi/vuecs`.

## Mapping

| vuecs (`docs/src/.vitepress/theme/`) | rapiq (`packages/docs/.vitepress/theme/`) |
|---|---|
| `components/Hero.vue` | `components/Hero.vue` |
| `components/FeatureGrid.vue` | `components/FeatureGrid.vue` |
| `components/ThemeShowcase.vue` | `components/PackageShowcase.vue` |
| `components/CodeTabs.vue` | `components/CodeTabs.vue` |
| `components/NuxtSection.vue` | `components/TypeormSection.vue` |
| `style.css` (Tailwind + `--vc-*` design tokens) | `style.css` (`--rq-*` tokens bound to VitePress `--vp-c-*` vars) |
| `.github/workflows/docs.yml` | `.github/workflows/docs.yml` |

## Behavioral differences

- **Wow moment**: vuecs uses a live palette switcher (`useColorPalette()` re-tints the page).
  rapiq instead runs a live query playground — `@rapiq/parser-simple` → `@rapiq/codec-url`
  (URL output) and `@rapiq/sql` (per-dialect SQL output) execute in the browser.
- **Tokens**: vuecs tokens come from `@vuecs/design` + Tailwind; rapiq has no CSS framework —
  its `--rq-*` tokens alias VitePress theme variables, so no extra dependencies are needed.
- **Layout**: vuecs docs live in `docs/src/` with `srcDir`; rapiq docs are rooted at
  `packages/docs/` (no `src/` level), so the workflow artifact path is
  `packages/docs/.vitepress/dist` instead of `docs/src/.vitepress/dist`.
- **Showcase axis**: vuecs showcases CSS frameworks (themes); rapiq showcases the six
  `@rapiq/*` packages, with cards linking to the GitHub package directories.

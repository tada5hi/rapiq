# @rapiq/docs

The [VitePress](https://vitepress.dev) documentation site for [rapiq](https://github.com/tada5hi/rapiq), published at [rapiq.tada5hi.net](https://rapiq.tada5hi.net). Private — not published to npm.

## Development

```sh
# from the repo root
npm run dev --workspace=packages/docs     # local dev server
npm run build --workspace=packages/docs   # production build (runs in CI)
```

Content lives in `getting-started/`, `guide/` and `integrations/`; navigation and sidebar are configured in `.vitepress/config.mjs`.

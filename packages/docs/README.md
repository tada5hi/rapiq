<p align="center">
  <a href="https://github.com/tada5hi/rapiq">
    <img src="https://raw.githubusercontent.com/tada5hi/rapiq/master/.github/assets/logo.svg" alt="rapiq" width="100" height="100">
  </a>
</p>

<h1 align="center">@rapiq/docs</h1>

<p align="center">
  <b>The <a href="https://vitepress.dev">VitePress</a> documentation site for <a href="https://github.com/tada5hi/rapiq">rapiq</a>.</b><br>
  Published at <a href="https://rapiq.tada5hi.net">rapiq.tada5hi.net</a> · private, not published to npm.
</p>

---

## Development

```sh
# from the repo root
npm run dev --workspace=packages/docs     # local dev server
npm run build --workspace=packages/docs   # production build (runs in CI)
```

Content lives in `getting-started/`, `guide/`, `packages/` and `integrations/`; navigation and sidebar are configured in `.vitepress/config.mjs`.

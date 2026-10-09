# rapiq

[rapiq](https://github.com/tada5hi/rapiq) (REST API query) for Python. This
distribution contains no code: it installs the rapiq parts, which share the
`rapiq.` import namespace.

```bash
pip install rapiq          # rapiq.core
pip install rapiq[all]     # every part
```

| Part | Distribution | Import |
|------|--------------|--------|
| core (expression parser, in-memory filter evaluation) | `rapiq-core` | `rapiq.core` |

Status: proof of concept. The API is not stable.

License: MIT.

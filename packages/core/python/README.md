# rapiq-core

The core of [rapiq](https://github.com/tada5hi/rapiq) (REST API query) for
Python, on the rapiq Rust core: parse filter expressions into the shared query
IR and evaluate them against dicts. Imported as `rapiq.core`.

Install this part alone, or the umbrella `rapiq`, which pulls in the parts
you select (`pip install rapiq[...]`).

Status: proof of concept. The API is not stable.

```python
from rapiq import core

filters = core.parse_expression_filters("and(eq(name, 'Peter'), gte(age, '18'))")
adults = core.compile_filters(filters).filter(users)

try:
    core.parse_expression_filters("eq(name")
except core.RapiqError as error:
    print(error.code)  # syntaxInvalid
```

License: MIT.

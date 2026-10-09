# rapiq

Python binding for the Rust core of [rapiq](https://github.com/tada5hi/rapiq)
(REST API query): parse filter expressions into the shared query IR and
evaluate them against dicts.

Status: proof of concept. The API is not stable.

```python
import rapiq

filters = rapiq.parse_expression_filters("and(eq(name, 'Peter'), gte(age, '18'))")
adults = rapiq.compile_filters(filters).filter(users)

try:
    rapiq.parse_expression_filters("eq(name")
except rapiq.RapiqError as error:
    print(error.code)  # syntaxInvalid
```

License: MIT.

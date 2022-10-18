# Parameter

## `Parameter`

The **Parameter** is used as input key for the [buildQuery](build-api-reference.md#buildquery) and
[parseQuery](parse-api-reference.md#parsequery) methods.

```typescript
export enum Parameter {
    FILTERS = 'filters',
    FIELDS = 'fields',
    PAGINATION = 'pagination',
    RELATIONS = 'relations',
    SORT = 'sort'
}
```

## `URLParameter`

The **URLParameter** is used as representation in the transpiled query string.
Besides, it can also be used as input key for the [buildQuery](build-api-reference.md#buildquery) and
[parseQuery](parse-api-reference.md#parsequery) methods.

```typescript
export enum URLParameter {
    FILTERS = 'filter',
    FIELDS = 'fields',
    PAGINATION = 'page',
    RELATIONS = 'include',
    SORT = 'sort'
}
```

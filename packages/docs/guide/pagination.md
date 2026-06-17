# Pagination

Limit the number of resources returned from the collection.

- **URL parameter**: `page`
- **AST node**: `Pagination { limit, offset }`

## Input format

```typescript
{
    pagination: {
        limit: 25,
        offset: 50,
    },
}
```

Both keys are optional. Values are coerced to integers; `limit` must be positive, `offset` non-negative. In URL form this is `page[limit]=25&page[offset]=50`.

## Schema options

```typescript
defineSchema<User>({
    pagination: {
        maxLimit: 50,
    },
});
```

| Option | Description |
|---|---|
| `maxLimit` | Upper bound for `limit`. A larger requested limit is clamped to `maxLimit`; when no limit is requested at all, `maxLimit` is applied as the limit. |

With `throwOnFailure`, exceeding `maxLimit` throws `PaginationParseError.limitExceeded()` instead of clamping.

# Pagination

Limit and offset the collection, with a server-side cap.

| | |
|---|---|
| URL key | `page` |
| AST node | `Pagination { limit, offset }` |
| Schema options | `maxLimit` |

## On the wire

```txt
page[limit]=25&page[offset]=50
```

Parser input shape:

```typescript
{
    pagination: {
        limit: 25,
        offset: 50,
    },
}
```

Both keys are optional. Values are coerced to integers; `limit` must be positive, `offset` non-negative. When a limit applies (requested, or set via `maxLimit`) and no offset was sent, the offset defaults to `0`.

## Building in code

```typescript
defineQuery<User>({ pagination: { limit: 25 } });

definePagination({ limit: 25, offset: 50 });   // standalone fragment
```

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

## Echoing pagination back

Adapters report the pagination they applied, so responses can carry an accurate `meta` block:

```typescript
const { pagination } = adapter.execute(query);          // TypeORM adapter
const { total, pagination } = applyQuery(query, data);  // memory

res.json({ data, meta: { total, ...pagination } });
```

## On violation

Out-of-range values are clamped/dropped silently. With [`throwOnFailure`](/guide/schemas#failure-behavior-drop-vs-throw), an invalid `limit` or `offset` throws `PaginationParseError.keyValueInvalid()` and exceeding `maxLimit` throws `PaginationParseError.limitExceeded()` instead of clamping.

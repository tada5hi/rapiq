# Pagination

## `PaginationBuildInput`

```typescript
type PaginationBuildInput<T> = {
    limit?: number,
    offset?: number
};
```

### Example

```typescript
import { PaginationBuildInput } from "rapiq";

const input : PaginationBuildInput = {
    limit: 50,
    offset: 0
};
```

## `PaginationParseOptions`
```typescript
export type PaginationParseOptions = {
    maxLimit?: number,
    throwOnFailure?: boolean
};
```

## `PaginationParseOutput`
```typescript
export type PaginationParseOutput = {
    limit?: number,
    offset?: number
};
```

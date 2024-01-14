# Pagination

## `parseQueryPagination`

**Type**
```ts
declare function parseQueryPagination(
    input: unknown,
    options?: PaginationParseOptions
): PaginationParseOutput
```

**Example**

```typescript
import {
    parseQueryPagination
} from 'rapiq';

const output = parseQueryPagination(
    {limit: 100},
    {
        maxLimit: 50
    }
);

console.log(output);
// {limit: 50}
```

**Type parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type                        | Description                                                          |
|:----------|:----------------------------|:---------------------------------------------------------------------|
| `input`   | `unknown`                   | Query input data passed e.g. via URL .                               |
| `options` | `PaginationParseOptions<T>` | Options for parsing pagination data [more](#paginationparseoptions). |

**Returns**

[PaginationParseOutput](#paginationparseoutput)

The function returns an object.

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

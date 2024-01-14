# Parse

## `parseQuery`

Parse a query string to an efficient data structure ⚡.
The output will be an object with each possible value of the [Parameter](parameter-api-reference.md#parameter) enum as property key and the
parsed data as value.

**Type**
```ts
declare function parseQuery(input: ParseInput, options?: ParseOptions): string;
```

**Example** 

```typescript
import {
    parseQuery,
} from 'rapiq';

const output = parseQuery({
    fields: ['+age'],
    filters: {
        name: '~pe'
    }
});

console.log(output);
//{
//    fields: [
//        {key: 'age', operator: FieldOperator.INCLUDE}
//    ],
//    filters: [
//        {key: 'name', value: 'pe', operator: FilterComparisonOperator.LIKE}
//   ]
//}
```

**Type Parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type           | Description                                                            |
|:----------|:---------------|:-----------------------------------------------------------------------|
| `input`   | `ParseInput`   | Query input data passed e.g. via URL [more](#parseinput).              |
| `options` | `ParseOptions` | Options for parsing fields, filter, include, ... [more](#parseoptions) |

**Returns**

[ParseOutput](#parseoutput)

The function returns an object.

**References**
- [ParseOutput](#parseoutput)
- [ParseOptions](#parseoptions)

## ParseOptions

```typescript
type ParseOptions = {
    [Parameter.FIELDS]?: FieldsParseOptions<T> | boolean,
    [Parameter.FILTERS]?: FiltersParseOptions<T> | boolean,
    [Parameter.RELATIONS]?: RelationsParseOptions<T> | boolean,
    [Parameter.PAGINATION]?: PaginationParseOptions | boolean,
    [Parameter.SORT]?: SortParseOptions<T> | boolean,
    defaultPath?: string,
    throwOnFailure?: boolean
}
```
**References**
- [Parameter](parameter-api-reference#parameter)
- [FieldsParseOptions](fields-api-reference.md#fieldsparseoptions),
- [FiltersParseOptions](filters-api-reference.md#filtersparseoptions)
- [PaginationParseOptions](pagination-api-reference.md#paginationparseoptions)
- [RelationsParseOptions](relations-api-reference.md#relationsparseoptions)
- [SortParseOptions](sort-api-reference.md#sortparseoptions)

## ParseInput

````typescript
type ParseInput = {
    [K in Parameter | URLParameter]?: any
}
````
**References**
- [Parameter](parameter-api-reference#parameter)
- [URLParameter](parameter-api-reference.md#urlparameter)

## ParseOutput

```typescript
type ParseOutput = {
    [Parameter.FIELDS]?: FieldsParseOutput,
    [Parameter.FILTERS]?: FiltersParseOutput,
    [Parameter.RELATIONS]?: RelationsParseOutput,
    [Parameter.PAGINATION]?: PaginationParseOutput,
    [Parameter.SORT]?: SortParseOutput,
}
```
**References**
- [Parameter](parameter-api-reference#parameter)
- [FieldsParseOutput](fields-api-reference.md#fieldsparseoutput)
- [FiltersParseOutput](filters-api-reference.md#filtersparseoutput)
- [PaginationParseOutput](pagination-api-reference.md#paginationparseoutput)
- [RelationsParseOutput](relations-api-reference.md#relationsparseoutput)
- [SortParseOutput](sort-api-reference.md#sortparseoutput)





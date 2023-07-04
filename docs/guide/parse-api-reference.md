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

## `parseQueryParameter`

Parse a query string to an efficient data structure ⚡. The output will
be an object with each possible value of the [Parameter](parameter-api-reference#parameter) enum as property key and the
parsed data as value.

**Type**
```ts
declare function parseQueryParameter(
    key: T,
    input: unknown,
    options?: ParseParameterOptions<T>
): ParseParameterOutput<T>
```

**Example: Fields**

```typescript
import {
    parseQueryParameter,
} from 'rapiq';

const output = parseQueryParameter(
    // 'fields' ||
    // Parameter.FIELDS | URLParameter.FIELDS
    'fields',
    ['+name'],
    {
        allowed: ['id', 'name'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{key: 'id', value: FieldOperator.INCLUDE}] ||
// [{key: 'id', value: '+'}]
```

**Example: Filters**

```typescript
import {
    parseQueryParameter
} from 'rapiq';

const output = parseQueryParameter(
    // 'filters' | 'filter' |
    // Parameter.FILTERS | URLParameter.FILTERS
    'filters',
    {id: 1},
    {
        allowed: ['id', 'name'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{alias: 'user', key: 'id', value: 1, }]
```

**Example: Pagination**

```typescript
import {
    parseQueryParameter
} from 'rapiq';

const output = parseQueryParameter(
    // 'pagination' | 'page' |
    // Parameter.PAGINATION | URLParameter.PAGINATION
    'pagination',
    {limit: 100},
    {
        maxLimit: 50
    }
);

console.log(output);
// {limit: 50}
```

**Example: Relations**

```typescript
import {
    parseQueryParameter
} from 'rapiq';

const output = parseQueryParameter(
    // 'relations' || 'include' ||
    // Parameter.RELATIONS | URLParameter.RELATIONS
    'relations',
    ['roles'],
    {
        allowed: ['roles', 'photos'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{key: 'user.roles', value: 'roles'}]
```

**Example: Sort**

```typescript
import {
    parseQueryParameter
} from 'rapiq';

const output = parseQueryParameter(
    // 'sort' ||
    // Parameter.SORT || URLParameter.SORT
    'sort',
    ['-name'],
    {
        allowed: ['id', 'name'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{alias: 'user', key: 'name', value: 'DESC'}]
```

**Type parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type                               | Description                                                            |
|:----------|:-----------------------------------|:-----------------------------------------------------------------------|
| `input`   | `unknown`                          | Query input data passed e.g. via URL [more](#parseinput).              |
| `options` | `ParseParameterOptions<Parameter>` | Options for parsing fields, filter, include, ... [more](#parseoptions) |

**Returns**

[ParseOutput](#parseoutput)

The function returns an object.

## ParseOptions

```typescript
type ParseOptions = {
    /**
     * On default all query keys are enabled.
     */
    [K in Parameter]?: ParseParameterOptions<K> | boolean
} & {
    defaultPath?: string,
    throwOnFailure?: boolean
}
```
**References**
- [ParseParameterOptions](#parseparameteroptions)

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
    [K in Parameter]?: ParseParameterOutput<K>
}
```
**References**
- [ParseParameterOutput](#parseparameteroutput)

## ParseParameterOptions
```typescript
type ParseParameterOptions<
    P extends ParameterType | URLParameterType,
    T extends Record<string, any> = Record<string, any>
>;
```
is a generic type and returns the available options for a given parameter type:
**References**
- [FieldsParseOptions](fields-api-reference.md#fieldsparseoptions),
- [FiltersParseOptions](filters-api-reference.md#filtersparseoptions)
- [PaginationParseOptions](pagination-api-reference.md#paginationparseoptions)
- [RelationsParseOptions](relations-api-reference.md#relationsparseoptions)
- [SortParseOptions](sort-api-reference.md#sortparseoptions)

## ParseParameterOutput
```typescript
type ParseParameterOutput<P extends ParameterType | URLParameterType>;
```

is a generic type and returns the parsed output data for a given parameter type:

**References**
- [FieldsParseOutput](fields-api-reference.md#fieldsparseoutput)
- [FiltersParseOutput](filters-api-reference.md#filtersparseoutput)
- [PaginationParseOutput](pagination-api-reference.md#paginationparseoutput)
- [RelationsParseOutput](relations-api-reference.md#relationsparseoutput)
- [SortParseOutput](sort-api-reference.md#sortparseoutput)





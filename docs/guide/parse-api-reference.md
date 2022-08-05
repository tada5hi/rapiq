# Parse

## `parseQuery`

Parse a query string to an efficient data structure ⚡. The output will
be an object with each possible value of the [Parameter](parameter-api-reference.md#parameter) enum as property key and the
parsed data as value.

**Type**
```ts
function parseQuery(input: ParseInput, options?: ParseOptions): string;
```

**Example** 

```typescript
import {
    parseQuery,
} from 'hapiq';

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
//        {key: 'name', value: 'pe', operator: FilterOperator.LIKE}
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

## `parseQueryParameter`

Parse a query string to an efficient data structure ⚡. The output will
be an object with each possible value of the [Parameter](parameter-api-reference#parameter) enum as property key and the
parsed data as value.

**Type**
```ts
function parseQueryParameter(
    key: T,
    input: unknown,
    options?: ParseParameterOptions<T>
): ParseParameterOutput<T>
```

**Example: Fields**

```typescript
import {
    parseQueryParameter,
} from 'hapiq';

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
} from 'hapiq';

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
} from 'hapiq';

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
} from 'hapiq';

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
} from 'hapiq';

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
export type ParseOptions = {
    /**
     * On default all query keys are enabled.
     */
    [K in Parameter]?: ParseParameterOptions<K> | boolean
}
```
[ParseParameterOptions](#parseparameteroptions)

## ParseInput

````typescript
export type ParseInput = {
    [K in Parameter | URLParameter]?: any
}
````
[Parameter/URLParameter](parameter-api-reference#parameter)

## ParseOutput

```typescript
export type ParseOutput = {
    [K in Parameter]?: ParseParameterOutput<K>
}
```
[ParseParameterOutput](#parseparameteroutput)

## ParseParameterOptions
```typescript
type ParseParameterOptions<T extends ParameterType | URLParameterType>;
```
is a generic type and returns the available options for a given parameter type, e.g.
- [FieldsParseOptions](#filtersparseoptions),
- [FiltersParseOptions](#filtersparseoptions)
- ...

## ParseParameterOutput
```typescript
type ParseParameterOutput<T extends ParameterType | URLParameterType>
```

is a generic type and returns the parsed output data for a given parameter type, e.g.
- [FieldsParseOutput](#fieldsparseoutput)
- [FiltersParseOutput](#filtersparseoutput)
- ...


## `FieldsParseOptions`
```typescript
export type FieldsParseOptions =
    ParseOptionsBase<Parameter.FIELDS, Record<string, string[]> | string[]>;
```
The type structure looks like this:
```text
{
    aliasMapping?: Record<string, string>,
    allowed?: Record<string, string[]> | string[],
    relations?: RelationsParseOutput,
    defaultAlias?: string
}
```

## `FieldsParseOutput`

```typescript
export enum FieldOperator {
    INCLUDE = '+',
    EXCLUDE = '-'
}

export type FieldsParseOutputElement =
    ParseOutputElementBase<Parameter.FIELDS, FieldOperator>;
export type FieldsParseOutput =
    FieldsParseOutputElement[];
```
The type structure looks like this:
```text
{
    // relation/resource alias
    alias?: string,

    // field name
    key: string,

    // '+' | '-'
    value?: FieldOperator
}
```

## `FiltersParseOptions`

```typescript
export type FiltersParseOptions =
    ParseOptionsBase<Parameter.FILTERS>
```
The type structure looks like this:
```text
{
    aliasMapping?: Record<string, string>,
    allowed?: string[],
    relations?: RelationsParseOutput,
    defaultAlias?: string
}
```

## `FiltersParseOutput`
```typescript
export enum FilterOperatorLabel {
    NEGATION = 'negation',
    LIKE = 'like',
    IN = 'in'
}

export type FiltersParseOutputElement =
    ParseOutputElementBase<
        Parameter.FILTERS,
        FilterValue<string | number | boolean | null>
    > & {
        operator?: {
            [K in FilterOperatorLabel]?: boolean
        }
    };
export type FiltersParseOutput = FiltersParseOutputElement[];
```
```text
{
    // relation/resource alias
    alias?: string,

    // filter name
    key: string,

    // {in: ..., ...}
    operator?: {
        [K in FilterOperatorLabel]?: boolean
    },

    value: FilterValue<string | number | boolean | null>
}
```

## `PaginationParseOptions`
```typescript
export type PaginationParseOptions =
    ParseOptionsBase<Parameter.PAGINATION> & {
        maxLimit?: number
    };
```
The type structure looks like this:
```text
{
    maxLimit?: number
}
```

## `PaginationParseOutput`
```typescript
export type PaginationParseOutput = {
    limit?: number,
    offset?: number
};
```

## `RelationsParseOptions`

```typescript
export type RelationsParseOptions =
    ParseOptionsBase<Parameter.SORT, string[] | string[][]>;
```
The type structure looks like this:
```text
{
    aliasMapping?: Record<string, string>,
    allowed?: string[],
    defaultAlias?: string,
    includeParents?: boolean | string[] | string
}
```

## `RelationsParseOutput`
```typescript
export type RelationsParseOutputElement =
    ParseOutputElementBase<Parameter.RELATIONS, string>;
export type RelationsParseOutput = RelationsParseOutputElement[];
```
The type structure looks like this:
```text
{
    // relation relative depth path
    key: string,

    // relation alias
    value: string
}
```

## `SortParseOptions`
```typescript
export type SortParseOptions = ParseOptionsBase<Parameter.SORT, string[] | string[][]>;
```

The type structure looks like this:
```text
{
    aliasMapping?: Record<string, string>,
    allowed?: string[] | string[][],
    defaultAlias?: string
    relations?: RelationsParseOutput
}
```

## `SortParseOutput`
```typescript
export enum SortDirection {
    ASC = 'ASC',
    DESC = 'DESC'
}

export type SortParseOutputElement =
    ParseOutputElementBase<Parameter.SORT, SortDirection>;
export type SortParseOutput = SortParseOutputElement[];
```
The type structure looks like this:
```text
{
    // resource/relation alias
    alias?: string,

    // field name
    key: string,

    // 'ASC' | 'DESC'
    value: SortDirection
}
```

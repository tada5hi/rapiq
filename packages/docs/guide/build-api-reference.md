# Build

## `buildQuery`

Build a query string from a provided [BuildInput](#buildinput) object for a generic Record `<T>`.
The allowed input keys are values of the [Parameter](parameter-api-reference.md#parameter) or 
[URLParameter](parameter-api-reference.md#urlparameter) enum.

**Type**
```ts
declare function buildQuery<T>(record: BuildInput<T>): string;
```

**Example**
```typescript
import {
    buildQuery
} from "rapiq";

type User = {
    id: number,
    name: string,
    age?: number
}

const query: string = buildQuery<User>({
    fields: ['+age'],
    relations: {
        name: '~pe'
    }
});

console.log(query);
// ?fields=+age&filter[name]=~pe
```

**Type Parameters**

| Name   | Description                                                     |
|:-------|:----------------------------------------------------------------|
| `T`    | A type, interface, or class which represent the data structure. |


**Parameters**

| Name      | Type              | Description                                       |
|:----------|:------------------|:--------------------------------------------------|
| `input`   | `BuildInput`<`T`> | Input specification [more](#buildinput).          |

**Returns**

`string`

The function returns a string, which can be parsed with the [parseQuery](parse-api-reference#parsequery) function.

I.e. `/users?page[limit]=10&page[offset]=0&include=profile&filter[id]=1&fields[user]=id,name`

**References**
- [BuildInput](#buildinput)

## `BuildInput`

```typescript
type BuildInput<
    T extends Record<string, any>
> = {
    [P in Parameter | URLParameter]?: BuildParameterInput<P, T>
}
```

**References**
- [BuildParameterInput](#buildparameterinput)

## BuildParameterInput
```typescript
declare type BuildParameterInput<
    P extends ParameterType | URLParameterType,
    T extends Record<string, any> = Record<string, any>
>;
```

is a generic type and returns the input structure for a given parameter type:

**References**
- [FieldsBuildInput](fields-api-reference.md#fieldsbuildinput)
- [FiltersBuildInput](filters-api-reference.md#filtersbuildinput)
- [PaginationBuildInput](pagination-api-reference.md#paginationbuildinput)
- [RelationsBuildInput](relations-api-reference.md#relationsbuildinput)
- [SortBuildInput](sort-api-reference.md#sortbuildinput)

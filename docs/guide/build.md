# Build 🔧

The first step is to construct a [BuildInput](build-api-reference#buildinput) object for a generic Record `<T>`.
Pass the object to the [buildQuery](build-api-reference#buildquery) method to convert it to a transportable string.

The `BuildInput<T>` can contain a configuration for each 
[Parameter](parameter-api-reference.md#parameter)/[URLParameter](parameter-api-reference.md#urlparameter).
- [Fields](fields-api-reference.md#fieldsbuildinput): `FieldsBuildInput<T>`
- [Filter(s)](filters-api-reference.md#filtersbuildinput): `FiltersBuildInput<T>`
- [Pagination](pagination-api-reference.md#paginationbuildinput): `PaginationBuildInput<T>`
- [Relations](relations-api-reference.md#relationsbuildinput): `RelationsBuildInput<T>`
- [Sort](sort-api-reference.md#sortbuildinput): `SortBuildInput<T>`

::: tip
Check out the API-Reference of each parameter for acceptable input formats and examples.
:::

After building, the string can be passed to a backend application as http query string argument.
The backend application can process the request, by [parsing](parse.md) the query string.


## Example

The following example is based on the assumption, that the following packages are installed:
- [express](https://www.npmjs.com/package/express)
- [typeorm](https://www.npmjs.com/package/typeorm)
- [typeorm-extension](https://www.npmjs.com/package/typeorm-extension)

It should give an insight on how to use this library.
Therefore, a type which will represent a `User` and a method `getAPIUsers` are defined.
The method should perform a request to the resource API to receive a collection of entities.

```typescript
import axios from "axios";
import {
    buildQuery,
    BuildInput
} from "rapiq";

export type Realm = {
    id: string,
    name: string,
    description: string,
}

export type Item = {
    id: string,
    realm: Realm,
    user: User
}

export type User = {
    id: number,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: Item[]
}

type ResponsePayload = {
    data: User[],
    meta: {
        limit: number,
        offset: number,
        total: number
    }
}

const record: BuildInput<User> = {
    pagination: {
        limit: 20,
        offset: 10
    },
    filters: {
        id: 1
    },
    fields: ['id', 'name'], 
    sort: '-id', 
    relations: ['realm']
};

const query = buildQuery(record);
// console.log(query);
// ?filter[id]=1&fields=id,name&page[limit]=20&page[offset]=10&sort=-id&include=realm

async function getAPIUsers(
    record: BuildInput<User>
): Promise<ResponsePayload> {
    const response = await axios.get('users' + buildQuery(record));

    return response.data;
}

(async () => {
    let response = await getAPIUsers(record);

    // do something with the response :)
})();
```

The next [section](parse.md) will describe, how to parse the query string on the backend side.

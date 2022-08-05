# Build 🏗

The first step is to construct a [BuildInput](build-api-reference#buildinput) object for a generic Record `<T>` and 
pass it to the [buildQuery](build-api-reference#buildquery) method to convert it to a string.

The result string can then be provided as a URL query string to a backend application.
The backend application can than process the request, by [parsing](parse.md) the query string.

The following example should give an insight on how to use this library.
Therefore, a type which will represent a `User` and a method `getAPIUsers` are defined.
The method should perform a request to the resource API to receive a collection of entities.

```typescript
import axios from "axios";
import {
    buildQuery,
    BuildInput
} from "rapiq";

type Profile = {
    id: number;
    avatar: string;
    cover: string;
}

type User = {
    id: number;
    name: string;
    age?: number;
    profile: Profile;
}

type ResponsePayload = {
    data: User[],
    meta: {
        limit: number,
        offset: number,
        total: number
    }
}

export async function getAPIUsers(
    record: BuildInput<User>
): Promise<ResponsePayload> {
    const response = await axios.get('users' + buildQuery(record));

    return response.data;
}

(async () => {
    const record: BuildInput<User> = {
        pagination: {
            limit: 20,
            offset: 10
        },
        filters: {
            id: 1 // some possible values:
            // 1 | [1,2,3] | '!1' | '~1' | ['!1',2,3] | {profile: {avatar: 'xxx.jpg'}}
        },
        fields: ['id', 'name'], // some possible values:
        // 'id' | ['id', 'name'] | '+id' | {user: ['id', 'name'], profile: ['avatar']}
        sort: '-id', // some possible values:
        // 'id' | ['id', 'name'] | '-id' | {id: 'DESC', profile: {avatar: 'ASC'}}
        relations: {
            profile: true
        }
    };

    const query = buildQuery(record);

    // console.log(query);
    // ?filter[id]=1&fields=id,name&page[limit]=20&page[offset]=10&sort=-id&include=profile

    let response = await getAPIUsers(record);

    // do something with the response :)
})();
```

The next [section](parse) will describe, how to parse the query string on the backend side.

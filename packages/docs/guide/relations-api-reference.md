# Relations

## `parseQueryRelations`

**Type**
```ts
declare function parseQueryRelations<T>(
    input: unknown,
    options?: RelationsParseOptions<T>
): RelationsParseOutput
```

**Example**

```typescript
import {
    parseQueryRelations
} from 'rapiq';

const output = parseQueryRelations(
    ['roles'],
    {
        allowed: ['roles', 'photos'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{key: 'user.roles', value: 'roles'}]
```

**Type parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type                       | Description                                                        |
|:----------|:---------------------------|:-------------------------------------------------------------------|
| `input`   | `unknown`                  | Query input data passed e.g. via URL .                             |
| `options` | `RelationsParseOptions<T>` | Options for parsing relations data [more](#relationsparseoptions). |

**Returns**

[RelationsParseOutput](#relationsparseoutput)

The function returns an object.

## `RelationsBuildInput`

The following types are defined, to illustrate which kind of input data is covered by the
`RelationsBuildInput<T>` type.

```typescript
type Realm = {
    id: number,
    name: string,
    description: string,
}

type Item = {
    id: string,
    realm: Realm
}

type User = {
    id: string,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: Item[]
}
```

:::info
There are different input structures, which can be used to define input data.
:::

### Formats

**`Array`**
The following example will overwrite the **default** parse options relations.

```typescript
import { RelationsBuildInput } from "rapiq";

const input : RelationsBuildInput<User> = [
    'realm',
    'items',
    'items.realm'
];
```

**`Object`**

The object syntax can be mixed with the array format to specify related resources.

```typescript
import { RelationsBuildInput } from "rapiq";

const input : RelationsBuildInput<User> = {
    realm: true,
    items: ['realm']
};
```

## `RelationsParseOptions`

```typescript
export type RelationsParseOptions<
    T extends Record<string, any> = Record<string, any>,
    > = {
        allowed?: NestedResourceKeys<T>[],
        includeParents?: boolean | string[] | string,
        // maps input name to local name
        mapping?: Record<string, string>,
        // set alternate value for relation key.
        pathMapping?: Record<string, string>,
        throwOnFailure?: boolean
    };
```

## `RelationsParseOutput`
```typescript
export type RelationsParseOutputElement = {
    key: string,
    value: string
};
export type RelationsParseOutput = RelationsParseOutputElement[];
```

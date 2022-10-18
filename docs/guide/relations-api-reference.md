# Relations

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
        // maps input name to local name
        mapping?: Record<string, string>,
        // set alternate value for relation key.
        pathMapping?: Record<string, string>,
        defaultAlias?: string,
        includeParents?: boolean | string[] | string
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

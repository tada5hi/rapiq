# Sort

## `parseQuerySort`

**Type**
```ts
declare function parseQuerySort<T>(
    input: unknown,
    options?: SortParseOptions<T>
): SortParseOutput
```

**Example**

```typescript
import {
    parseQuerySort
} from 'rapiq';

const output = parseQuerySort(
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

| Name      | Type                  | Description                                              |
|:----------|:----------------------|:---------------------------------------------------------|
| `input`   | `unknown`             | Query input data passed e.g. via URL .                   |
| `options` | `SortParseOptions<T>` | Options for parsing sort data [more](#sortparseoptions). |

**Returns**

[SortParseOutput](#sortparseoutput)

The function returns an object.

## `SortBuildInput`

The following types are defined, to illustrate which kind of input data is covered by the
`SortBuildInput<T>` type.

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
import { SortBuildInput } from "rapiq";

const input : SortBuildInput<User> = [
    'age',
    'name'
];
```

**`Object`**

The object syntax can be mixed with the array format to specify related resources.

```typescript
import { SortBuildInput } from "rapiq";

const input : SortBuildInput<User> = {
    age: 'ASC',
    realm: ['-name']
};
```

### Asc & Desc

By default, the entities should be sorted **asc**ending, without specifying any prefix.
To sort entities in **desc**ending order, prefix the (related resource) field name with `-`.

```typescript
import { SortBuildInput } from "rapiq";

const input : SortBuildInput<User> = [
    '-name'
];
```

## `SortParseOptions`
```typescript
type SortPaseDefaultOption<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        SortPaseDefaultOption<Flatten<T[K]>> :
        `${SortDirection}`
} | {
    [K in NestedKeys<T>]?: `${SortDirection}`
};

type SortParseOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    allowed?: ParseAllowedOption<T>,
    mapping?: Record<string, string>,
    default?: SortPaseDefaultOption<T>,
    defaultPath?: string,
    throwOnFailure?: boolean,
    relations?: RelationsParseOutput,
};
```

## `SortParseOutput`
```typescript
export type SortParseOutputElement = {
    key: string,
    value: 'ASC' | 'DESC',
    path?: string
};
export type SortParseOutput = SortParseOutputElement[];
```

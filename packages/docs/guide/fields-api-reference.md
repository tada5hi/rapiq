# Fields

## `parseQueryFields`

**Type**
```ts
declare function parseQueryFields<T>(
    input: unknown,
    options?: FieldsParseOptions<T>
): FieldsParseOutput
```

**Example**

```typescript
import {
    parseQueryFields,
} from 'rapiq';

const output = parseQueryFields(
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

**Type parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type                    | Description                                                  |
|:----------|:------------------------|:-------------------------------------------------------------|
| `input`   | `unknown`               | Query input data passed e.g. via URL .                       |
| `options` | `FieldsParseOptions<T>` | Options for parsing fields data [more](#fieldsparseoptions). |

**Returns**

[FieldsParseOutput](#fieldsparseoutput)

The function returns an object.

## `FieldsBuildInput`
The following types are defined, to illustrate which kind of input data is covered by the 
`FieldsBuildInput<T>` type.

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

The array syntax can be used, to specify direct properties as well properties of related resources.
The following example will overwrite the **default** fields ([FieldsParseOptions](#fieldsparseoptions)) for each referenced resource.

```typescript
import { FieldsBuildInput } from "rapiq";

const input : FieldsBuildInput<User> = [
    'id',
    'name',
    'realm.id',
    'items.id',
    'items.realm.name'
];
```

**`Object`**

The object syntax can be mixed with the array format to specify direct properties as well properties of related resources. 

```typescript
import { FieldsBuildInput } from "rapiq";

const input : FieldsBuildInput<User> = [
    ['id', 'name'],
    {
        realm: ['id'],
        items: [
            'id',
            'realm.id'
        ]
    }
];
```

### Include & Exclude

To **include** field in addition to the default fields, defined by the ParseOptions, prefix the field name with `+`.
To **exclude** a default field use the `-` prefix.

```typescript
import { FieldsBuildInput } from "rapiq";

const input : FieldsBuildInput<User> = [
    '+email',
    '-name',
];
```

## `FieldsParseOptions`

```typescript
type FieldsParseOptions<T extends Record<string, any> = Record<string, any>,
    > = {
    mapping?: Record<string, string>,
    allowed?: ParseAllowedOption<T>,
    default?: ParseAllowedOption<T>,
    defaultPath?: string,
    relations?: RelationsParseOutput,
    throwOnFailure?: boolean
};
```

## `FieldsParseOutput`

```typescript
export type FieldsParseOutputElement = {
    key: string,
    path?: string,
    value?: string
};
export type FieldsParseOutput = FieldsParseOutputElement[];
```


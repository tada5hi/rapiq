# Filters

## `parseQueryFilters`

**Type**
```ts
declare function parseQueryFilters<T>(
    input: unknown,
    options?: FiltersParseOptions<T>
): FiltersParseOutput
```

**Example**

```typescript
import {
    parseQueryFilters
} from 'rapiq';

const output = parseQueryFilters(
    {id: 1},
    {
        allowed: ['id', 'name'],
        defaultAlias: 'user'
    }
);

console.log(output);
// [{alias: 'user', key: 'id', value: 1, }]
```

**Type parameters**

| Name  | Description |
|:------|:------------|


**Parameters**

| Name      | Type                     | Description                                                    |
|:----------|:-------------------------|:---------------------------------------------------------------|
| `input`   | `unknown`                | Query input data passed e.g. via URL .                         |
| `options` | `FiltersParseOptions<T>` | Options for parsing filters data [more](#filtersparseoptions). |

**Returns**

[FiltersParseOutput](#filtersparseoutput)

The function returns an object.

## `FiltersBuildInput`

The following types are defined, to illustrate which kind of input data is covered by the
`FiltersBuildInput<T>` type.

```typescript
type Realm = {
    id: number,
    name: string,
    description: string,
}

type item = {
    id: string,
    realm: Realm
}

type User = {
    id: string,
    name: string,
    email: string,
    age: number,
    realm: Realm,
    items: item[]
}
```

### Example(s)

**`Simple`**

Simple attribute filtering

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    id: 1
};
```

**`Nested`**

Nested resource attribute filtering

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    'items.name': 'admin'
};
```

equal to

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    items: {
        name: 'admin'
    }
};
```

### Operators

:::tip
Some operators (e.g `!` & `~`) can also be combined. Possible options should 
be type hinted by the typescript compiler and visible by the IDE.
::: 

**`Negation`**

The **negation** operator can be applied by prefixing the filter value with `!`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    id: '!1'
};
```

**`Like`**

The **like** operator can be applied by prefixing xand suffixing the filter value with `~`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    name: '~adm'
};
```

**`LessThan`**

The **less than** operator can be applied by prefixing the filter value with `<`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    age: '<60'
};
```

**`LessThanEqual`**

The **less than equal** operator can be applied by prefixing the filter value with `<=`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    age: '<=18'
};
```

**`GreaterThan`**

The **greater than** operator can be applied by prefixing the filter value with `>`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    age: '>18'
};
```

**`GreaterThanEqual`**

The **greater than equal** operator can be applied by prefixing the filter value with `>=`

```typescript
import { FiltersBuildInput } from "rapiq";

const input : FiltersBuildInput<User> = {
    age: '>=18'
};
```

## `FiltersParseOptions`

```typescript
type FiltersParseOptionsDefault<T extends Record<string, any>> = {
    [K in keyof T]?: Flatten<T[K]> extends OnlyObject<T[K]> ?
        FiltersParseDefaultOption<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

type FiltersParseOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    mapping?: Record<string, string>,
    allowed?: ParseAllowedOption<T>,
    default?: FiltersParseDefaultOption<T>,
    defaultByElement?: boolean,
    defaultPath?: string,
    relations?: RelationsParseOutput,
    throwOnFailure?: boolean
};
```

## `FiltersParseOutput`

```typescript
type FiltersParseOutputElement = {
    operator: `${FilterComparisonOperator}`,
    value: FilterValueSimple,
    key: string,
    path?: string
};
type FiltersParseOutput = FiltersParseOutputElement[];
```

# Filters

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
        FiltersParseOptionsDefault<Flatten<T[K]>> :
        (K extends string ? FilterValue<TypeFromNestedKeyPath<T, K>> : never)
} | {
    [K in NestedKeys<T>]?: FilterValue<TypeFromNestedKeyPath<T, K>>
};

type FiltersParseOptions<
    T extends Record<string, any> = Record<string, any>,
> = {
    mapping?: Record<string, string>,
    allowed?: ParseOptionsAllowed<T>,
    default?: FiltersParseOptionsDefault<T>,
    defaultByElement?: boolean,
    defaultPath?: string,
    relations?: RelationsParseOutput
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

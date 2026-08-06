# Extensible Condition Contract Design

## Context

`ICondition` is rapiq's public extension point for filter conditions. The two
built-in implementations are `IFilter` and `IFilters`, but consumers may define
other structural implementations and pair them with their own visitors or
adapters.

`ICondition` currently declares only serializable data:

```ts
interface ICondition<T = unknown> {
    readonly operator: string;
    readonly value: T;
    readonly sealed?: boolean;
}
```

Consequently, a plain object produced by a JSON, RPC, or cache round trip also
satisfies the interface even though it has no behavior. The built-in condition
helpers worked around that by accepting a private
`ConditionNode = IFilter | IFilters` union. That protects the helpers from
detached data but closes them to legitimate custom condition implementations.

The single public abstraction will remain `ICondition`. It will distinguish
live, extensible condition objects from detached data by declaring the two
behaviors every condition provides: visitor dispatch and immutable sealing.
The private `ConditionNode` alias will be removed completely.

## Goals

- Keep `ICondition` as the only public type for built-in and custom condition
  implementations.
- Require every well-typed condition to provide `accept()` and `seal()`.
- Provide a useful generic visitor path without closing the extension set.
- Preserve the specialized visitors for built-in and custom condition kinds.
- Use `ICondition` directly in `and`, `or`, `not`, `elemMatch`,
  `IFilters.and()`, and `IFilters.or()`.
- Seal custom conditions polymorphically during standalone sealing and
  wrap-and-inject composition.
- Make detached `{ operator, value }` data fail normal TypeScript checking.
- Preserve runtime defenses for JavaScript, `any`, and explicit casts.
- Preserve the concrete return type of `seal()` for built-in and custom
  implementations.

## Non-goals

- Do not constrain `ICondition` to `IFilter | IFilters`.
- Do not introduce another condition-node union or nominal package-local
  brand.
- Do not require custom conditions to extend a rapiq class.
- Do not add serialization or rehydration behavior for detached conditions.
- Do not teach built-in adapters how to lower arbitrary custom condition
  kinds; custom consumers remain responsible for their own lowering.
- Do not change merge, flatten, parser, codec, or built-in adapter semantics.

## Open Visitor Contract

`IConditionVisitor` supplies one fallback that can handle every current or
future condition:

```ts
interface IConditionVisitor<R> {
    visitCondition(condition: ICondition): R;
}

interface ICondition<T = unknown> {
    readonly operator: string;
    readonly value: T;
    readonly sealed?: boolean;

    accept<R>(visitor: IConditionVisitor<R>): R;
    seal(): ICondition<T>;
}
```

The fallback makes `accept()` useful on an abstract `ICondition` without
enumerating every possible condition kind. Specialized interfaces retain their
double-dispatch methods as overloads:

```ts
interface IFilter<OPERATOR, VALUE> extends ICondition<VALUE> {
    readonly field: string;
    accept<R>(visitor: IFilterVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    seal(): IFilter<OPERATOR, VALUE>;
}

interface IFilters<T extends ICondition = ICondition>
    extends ICondition<T[]> {
    accept<R>(visitor: IFiltersVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    seal(): IFilters<T>;
}
```

`Filter.accept()` prefers `visitFilter` when that method exists and otherwise
calls `visitCondition`. `Filters.accept()` does the same for `visitFilters`.
Existing specialized visitor implementations therefore remain source
compatible; they do not have to add the generic fallback.

A custom implementation follows the same structural pattern without extending
a built-in node type:

```ts
interface GeoVisitor<R> {
    visitGeo(condition: GeoCondition): R;
}

class GeoCondition implements ICondition<GeoBounds> {
    readonly operator = 'geo';

    constructor(
        readonly value: GeoBounds,
        readonly sealed?: boolean,
    ) {}

    accept<R>(visitor: GeoVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    accept<R>(visitor: GeoVisitor<R> | IConditionVisitor<R>): R {
        if ('visitGeo' in visitor) {
            return visitor.visitGeo(this);
        }

        return visitor.visitCondition(this);
    }

    seal(): GeoCondition {
        return this.sealed ? this : new GeoCondition(this.value, true);
    }
}
```

The existing `Condition` class represents the common data shape but is not a
complete node. It will become abstract and declare `accept()` and `seal()`, so
it remains available as an optional extension base while structural
implementations can continue to implement `ICondition` directly. `Filter` and
`Filters` already supply compatible methods and need no new runtime inheritance
relationship.

## Helper and Injection Signatures

The private `ConditionNode` declaration will be deleted. The public helpers and
collection combinators will consistently accept `ICondition`:

```ts
function elemMatch(field: string, value: ICondition): Filter;
function and(...conditions: ICondition[]): Filters;
function or(...conditions: ICondition[]): Filters;
function not(...conditions: ICondition[]): Filters;

interface IFilters {
    and(...conditions: ICondition[]): IFilters;
    or(...conditions: ICondition[]): IFilters;
}
```

The `Filters` implementation, its internal `wrap()` method, and its sealing
helper will use the same type. Custom conditions remain opaque during built-in
flatten and merge operations: they are carried as conditions rather than
mistaken for built-in leaves or groups.

## Built-in Node Discrimination

The built-in `isFilter()` and `isFilters()` guards currently infer node kind
from members such as `field` or `flatten`. Those member checks can accidentally
claim a custom condition that happens to expose the same property names.

Both guards will instead probe visitor dispatch with the existing
`dispatchesTo()` utility:

- a built-in leaf is a condition whose `accept()` dispatches to `visitFilter`;
- a built-in group is a condition whose `accept()` dispatches to
  `visitFilters`;
- a custom condition dispatching elsewhere or only through `visitCondition`
  matches neither guard and stays opaque.

The probe already catches an unsupported visitor method, so a non-matching
condition safely returns `false`. This remains cross-package compatible and
does not rely on `instanceof` or a package-local brand.

## Polymorphic Sealing

Both the standalone `seal()` helper and wrap-and-inject composition will invoke
the input's own `seal()` method when present. This is the behavior required for
custom conditions to participate in the non-displaceability contract.

The public helper will derive its result from the concrete method rather than
claim that every implementation returns its input type:

```ts
function seal<C extends ICondition>(condition: C): ReturnType<C['seal']>;
```

The concrete `Filter.seal()` and `Filters.seal()` methods will return their
concrete class types. A custom class returning `GeoCondition` therefore keeps
that type through `seal(custom)`; an abstractly held `ICondition` remains
abstract.

Runtime compatibility remains lenient. The helper and injection implementation
will check that `seal` is callable before invoking it. Detached data passed from
JavaScript, `any`, or an explicit cast remains unsealed rather than causing a
new exception at composition time. Existing downstream behavior remains
authoritative: a built-in adapter asked to lower an unrecognized condition
reports `ErrorCode.CONDITION_DETACHED`.

## Testing

A focused condition-contract spec under
`packages/core/test/unit/parameter/` will define a custom condition that is
neither `IFilter` nor `IFilters` and verify that:

- it structurally implements `ICondition` with its own specialized visitor and
  the generic condition visitor fallback;
- an abstract `ICondition` can dispatch through `IConditionVisitor`;
- standalone `and`, `or`, `not`, and `elemMatch` accept it;
- `IFilters.and()` and `IFilters.or()` accept it;
- `isFilter()` and `isFilters()` do not misclassify it, including when it uses
  member names such as `field` or `flatten`;
- standalone `seal(custom)` invokes its implementation and preserves its
  concrete return type;
- wrap-and-inject invokes its implementation and stores the sealed custom
  condition;
- a plain `{ operator, value }` object no longer implements `ICondition` and
  cannot be passed to helpers or injection methods, using `@ts-expect-error`;
- an untyped detached object remains unchanged by the lenient runtime sealing
  path.

The red phase uses both
`npx tsc --noEmit -p packages/core/tsconfig.json` and the focused core spec.
Before implementation, TypeScript must reject custom conditions at helpers
that use the private built-in union, the negative detached-data assertions must
be reported as unused, generic visitor dispatch must be absent, and the runtime
test must show that custom `seal()` is not invoked.

Existing non-node runtime tests will cast detached fixtures through `unknown`
so they continue testing untyped process boundaries without claiming that the
objects legitimately implement `ICondition`.

Verification also includes core unit tests, the emitted core declaration
bundle, the monorepo build/test/lint commands, and the docs build.

## Documentation

`packages/docs/guide/building-queries.md` will document `ICondition` as the
single extension contract and include a concise custom-condition example.

`packages/docs/guide/merging-queries.md` will explain that `and()` and `or()`
seal every `ICondition` through its own method, including custom
implementations, and that serialized data must be parsed, decoded, or rebuilt.

Package documentation will distinguish the open `ICondition` contract from
the two condition kinds understood by built-in adapters. `.agents/architecture.md`
will record that custom conditions remain opaque during built-in composition
and require a consumer that understands their visitor or operator semantics.

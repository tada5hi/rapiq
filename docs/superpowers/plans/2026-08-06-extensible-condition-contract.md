# Extensible Condition Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve issues #885 and #886 by making `ICondition` the sole open condition contract, removing the private `ConditionNode` type, and requiring live conditions to provide visitor dispatch and immutable sealing.

**Architecture:** `ICondition` gains a generic `IConditionVisitor` fallback plus a polymorphic `seal()` method. Built-in leaves and groups retain their specialized visitor overloads, while helpers and collection injection accept any structural `ICondition`. Built-in guards identify only their own node kinds through double dispatch; custom implementations stay opaque and are sealed through their own method.

**Tech Stack:** TypeScript 5, Vitest, npm workspaces, Nx, tsdown, VitePress.

## Global Constraints

- Work only in `/opt/projects/tada5hi/rapiq/.claude/worktrees/fix-885-886` on branch `fix/condition-node-contract-885-886`.
- Keep `ICondition` as the only public condition extension point. Do not add `ConditionNode`, a replacement union, a brand, or a closed discriminator.
- Support structural custom implementations that extend neither `IFilter` nor `IFilters` and need not extend the `Condition` class.
- Keep specialized `IFilterVisitor` and `IFiltersVisitor` consumers source-compatible; they must not be forced to implement `visitCondition`.
- Preserve lenient runtime behavior for detached data arriving through JavaScript, `any`, or an explicit cast: sealing returns such data unchanged when `seal` is not callable.
- Do not teach built-in plans or adapters how to interpret arbitrary custom operators. A custom condition needs a compatible consumer; built-in lowering continues to throw `ErrorCode.CONDITION_DETACHED` for unknown kinds.
- Keep all mutations immutable and preserve concrete return types from `seal()`.
- Follow red-green-refactor for each behavior change. Observe each red failure before modifying production code.
- Use `apply_patch` for edits, preserve existing copyright headers, and make only issue-related changes.

## File Map

| File | Responsibility |
|---|---|
| `packages/core/src/parameter/filters/condition.ts` | Declare the open generic visitor and behavioral condition contract. |
| `packages/core/src/parameter/filters/record/types.ts` | Make `IFilter` specialize `ICondition`. |
| `packages/core/src/parameter/filters/record/module.ts` | Dispatch to specialized or generic visitors and preserve leaf type on seal. |
| `packages/core/src/parameter/filters/record/check.ts` | Identify built-in leaves through visitor dispatch. |
| `packages/core/src/parameter/filters/collection/types.ts` | Make `IFilters` specialize `ICondition`. |
| `packages/core/src/parameter/filters/collection/module.ts` | Carry arbitrary conditions, dispatch visitors, and seal injected conditions polymorphically. |
| `packages/core/src/parameter/filters/collection/check.ts` | Identify built-in groups through visitor dispatch. |
| `packages/core/src/parameter/filters/helpers/module.ts` | Remove `ConditionNode`; accept `ICondition` directly. |
| `packages/core/src/parameter/filters/seal.ts` | Delegate sealing to the concrete condition method. |
| `packages/core/test/unit/parameter/condition-contract.spec.ts` | Pin the open extension contract, dispatch, guards, helpers, and sealing. |
| `packages/core/test/unit/parameter/filters-non-node.spec.ts` | Keep detached-data runtime coverage without claiming detached data implements `ICondition`. |
| `packages/core/test/unit/parameter/merge.spec.ts` | Keep the lenient runtime seal-boundary regression. |
| `packages/docs/guide/building-queries.md` | Document custom condition construction and visitor dispatch. |
| `packages/docs/guide/merging-queries.md` | Document custom sealing and detached-data boundaries. |
| `packages/docs/guide/query-ast.md` | Document generic and specialized visitor paths. |
| `packages/docs/packages/adapter-memory.md` | Clarify which conditions built-in adapters understand. |
| `.agents/architecture.md` | Record the open condition extension architecture. |

---

## Task 1: Make `ICondition` a Behavioral, Open Visitor Contract

**Files:**

- Create: `packages/core/test/unit/parameter/condition-contract.spec.ts`
- Modify: `packages/core/src/parameter/filters/condition.ts:8-43`
- Modify: `packages/core/src/parameter/filters/record/types.ts:8-48`
- Modify: `packages/core/src/parameter/filters/record/module.ts:8-52`
- Modify: `packages/core/src/parameter/filters/record/check.ts:8-19`
- Modify: `packages/core/src/parameter/filters/collection/types.ts:8-44`
- Modify: `packages/core/src/parameter/filters/collection/module.ts:8-49`
- Modify: `packages/core/src/parameter/filters/collection/check.ts:8-35`
- Modify: `packages/core/test/unit/parameter/filters-non-node.spec.ts:8-30,116-120`

### Step 1: Add compile-time and runtime tests that describe the contract

- [ ] Create `condition-contract.spec.ts` with this complete fixture and first test group:

```typescript
/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IConditionVisitor,
} from '../../../src';
import {
    FilterCompoundOperator,
    Filters,
    and,
    eq,
    isFilter,
    isFilters,
} from '../../../src';

type CustomValue = {
    scope: string,
};

interface ICustomConditionVisitor<R> {
    visitCustom(condition: CustomCondition): R;
}

class CustomCondition implements ICondition<CustomValue> {
    readonly operator = 'custom';

    readonly sealed?: boolean;

    constructor(
        readonly value: CustomValue,
        sealed?: boolean,
    ) {
        if (sealed) {
            this.sealed = true;
        }
    }

    accept<R>(visitor: ICustomConditionVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    accept<R>(visitor: ICustomConditionVisitor<R> | IConditionVisitor<R>): R {
        if ('visitCustom' in visitor) {
            return visitor.visitCustom(this);
        }

        return visitor.visitCondition(this);
    }

    seal(): CustomCondition {
        return this.sealed ? this : new CustomCondition(this.value, true);
    }
}

class CollidingCondition extends CustomCondition {
    readonly field = 'not-a-built-in-leaf';

    flatten(): this {
        return this;
    }
}

describe('src/parameter/filters condition contract', () => {
    it('should dispatch abstract built-in conditions to the generic visitor', () => {
        const visitor: IConditionVisitor<string> = {
            visitCondition: condition => condition.operator,
        };
        const leaf: ICondition = eq('name', 'Peter');
        const group: ICondition = and(eq('active', true));

        expect(leaf.accept(visitor)).toBe('eq');
        expect(group.accept(visitor)).toBe('and');
    });

    it('should let a structural custom condition expose both visitor paths', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(condition.accept({
            visitCustom: input => input.value.scope,
        })).toBe('tenant-a');
        expect(condition.accept({
            visitCondition: input => input.operator,
        })).toBe('custom');
    });

    it('should discriminate built-in kinds by dispatch rather than member names', () => {
        const condition = new CollidingCondition({ scope: 'tenant-a' });

        expect(isFilter(condition)).toBe(false);
        expect(isFilters(condition)).toBe(false);
    });

    it('should reject detached data at typed condition boundaries', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        // @ts-expect-error detached data has no visitor or sealing behavior
        const condition: ICondition = detached;
        // @ts-expect-error helpers accept live ICondition implementations
        and(detached);
        // @ts-expect-error injection accepts live ICondition implementations
        new Filters(FilterCompoundOperator.AND, []).and(detached);

        expect(condition).toBe(detached);
    });
});
```

### Step 2: Run the red phase and inspect the expected failures

- [ ] Run the focused type-check:

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
```

Expected failures include:

- `IConditionVisitor` is not exported.
- `ICondition` has no `accept()` method.
- the two detached-data `@ts-expect-error` directives are unused.

- [ ] Run the focused spec:

```bash
npm run test --workspace=packages/core -- test/unit/parameter/condition-contract.spec.ts
```

Expected runtime failure: a built-in node tries to call the absent specialized method on the generic visitor. The colliding-condition guard assertion also fails because the current guards infer kind from `field` and `flatten` members.

### Step 3: Declare the open visitor and condition behavior

- [ ] In `condition.ts`, add `IConditionVisitor` before `ICondition`, make `ICondition` behavioral, and make `Condition` an optional abstract implementation base:

```typescript
export interface IConditionVisitor<R> {
    visitCondition(condition: ICondition): R;
}

export interface ICondition<T = unknown> {
    readonly operator: string;
    readonly value: T;
    readonly sealed?: boolean;

    accept<R>(visitor: IConditionVisitor<R>): R;
    seal(): ICondition<T>;
}

export type ConditionOptions = {
    sealed?: boolean,
};

export abstract class Condition<T = unknown> implements ICondition<T> {
    readonly operator: string;

    readonly value: T;

    readonly sealed?: boolean;

    constructor(
        operator: string,
        value: T,
        options: ConditionOptions = {},
    ) {
        this.operator = operator;
        this.value = value;

        if (options.sealed) {
            this.sealed = true;
        }
    }

    abstract accept<R>(visitor: IConditionVisitor<R>): R;

    abstract seal(): Condition<T>;
}
```

Retain the existing `sealed` API documentation on `ICondition`, and add short TSDoc explaining that `visitCondition` is the open fallback and `Condition` is optional.

### Step 4: Specialize the contract for built-in leaves and groups

- [ ] In `record/types.ts`, import `ICondition` and `IConditionVisitor`, extend the shared contract, retain the specialized overload, and make `seal()` preserve its parameters:

```typescript
export interface IFilter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> extends ICondition<VALUE> {
    readonly field: string;
    readonly operator: string | OPERATOR;
    readonly value: VALUE;
    readonly sealed?: boolean;

    accept<R>(visitor: IFilterVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;

    seal(): IFilter<OPERATOR, VALUE>;
}
```

- [ ] In `collection/types.ts`, extend `ICondition<T[]>` and add the generic visitor overload:

```typescript
export interface IFilters<
    T extends ICondition = ICondition,
> extends ICondition<T[]> {
    readonly operator: string;
    readonly value: T[];
    readonly sealed?: boolean;

    accept<R>(visitor: IFiltersVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;

    seal(): IFilters<T>;
    flatten(items?: T[]): IFilters<T>;
    merge(other: IFilters): IFilters;
    and(...conditions: ICondition[]): IFilters;
    or(...conditions: ICondition[]): IFilters;
}
```

### Step 5: Implement specialized-first visitor dispatch

- [ ] In `record/module.ts`, import `IConditionVisitor`, add overload declarations, and return the concrete class from `seal()`:

```typescript
accept<R>(visitor: IFilterVisitor<R>): R;
accept<R>(visitor: IConditionVisitor<R>): R;
accept<R>(visitor: IFilterVisitor<R> | IConditionVisitor<R>): R {
    if ('visitFilter' in visitor) {
        return visitor.visitFilter(this);
    }

    return visitor.visitCondition(this);
}

seal(): Filter<OPERATOR, VALUE> {
    if (this.sealed) {
        return this;
    }

    return new Filter<OPERATOR, VALUE>(
        this.operator,
        this.field,
        this.value,
        { sealed: true },
    );
}
```

- [ ] In `collection/module.ts`, replace the `Condition` type bound with `ICondition`, import `IConditionVisitor`, add overload declarations, and preserve the concrete group type from `seal()`:

```typescript
export class Filters<
    T extends ICondition = ICondition,
> implements IFilters<T> {
    // existing fields and constructor

    accept<R>(visitor: IFiltersVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    accept<R>(visitor: IFiltersVisitor<R> | IConditionVisitor<R>): R {
        if ('visitFilters' in visitor) {
            return visitor.visitFilters(this);
        }

        return visitor.visitCondition(this);
    }

    seal(): Filters<T> {
        if (this.sealed) {
            return this;
        }

        return new Filters<T>(this.operator, this.value, { sealed: true });
    }
}
```

Keep the remaining `Filters` methods intact in this step.

### Step 6: Make built-in guards use double dispatch

- [ ] Replace member-shape detection in `record/check.ts` with:

```typescript
import { dispatchesTo } from '../../../utils';
import type { IFilter, IFilterVisitor } from './types';

export function isFilter(input: unknown): input is IFilter {
    return dispatchesTo<IFilterVisitor<unknown>>(input, 'visitFilter');
}
```

- [ ] Replace member-shape detection in `collection/check.ts` with:

```typescript
import type { ICondition } from '../condition';
import { dispatchesTo } from '../../../utils';
import type { IFilters, IFiltersVisitor } from './types';

export function isFilters(
    input: ICondition,
    operator?: string,
): input is IFilters {
    if (!dispatchesTo<IFiltersVisitor<unknown>>(input, 'visitFilters')) {
        return false;
    }

    return operator ? operator === input.operator : true;
}
```

Do not use `field`, `flatten`, `instanceof`, or a brand for discrimination.

### Step 7: Keep detached runtime fixtures explicitly untyped

- [ ] In `filters-non-node.spec.ts`, define `NON_NODE` through the unsafe boundary and update the last cast:

```typescript
const NON_NODE = {
    operator: 'eq',
    value: 'ACME',
} as unknown as ICondition;
```

```typescript
expect(() => defineFilters(
    { operator: 'eq', field: 'x' } as unknown as ICondition,
)).toThrow(BuildError);
```

Update the leading comment to say the fixture represents detached data admitted through an explicit process-boundary cast, not a valid structural implementation.

### Step 8: Run green checks and commit

- [ ] Run:

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
npm run test --workspace=packages/core -- test/unit/parameter/condition-contract.spec.ts
npm run test --workspace=packages/core
```

Expected: all commands exit 0; the new visitor and guard tests pass, and the existing core suite remains green.

- [ ] Inspect the diff for closed unions or behavior regressions:

```bash
rg -n "extends Condition" packages/core/src/parameter/filters
git diff --check
git diff -- packages/core/src packages/core/test
```

Expected: no `Filters extends Condition` match; `ConditionNode` still exists only in the helper module until Task 2; `git diff --check` is silent.

- [ ] Commit:

```bash
git add packages/core/src/parameter/filters packages/core/test/unit/parameter/condition-contract.spec.ts packages/core/test/unit/parameter/filters-non-node.spec.ts
git commit -m "refactor(core)!: make conditions behavioral"
```

---

## Task 2: Accept and Seal Custom Conditions Throughout Composition

**Files:**

- Modify: `packages/core/test/unit/parameter/condition-contract.spec.ts`
- Modify: `packages/core/src/parameter/filters/helpers/module.ts:8-24,179-202`
- Modify: `packages/core/src/parameter/filters/seal.ts:8-39`
- Modify: `packages/core/src/parameter/filters/collection/module.ts:134-188`
- Modify: `packages/core/test/unit/parameter/merge.spec.ts:393-403`

### Step 1: Add helper, injection, and polymorphic-seal tests

- [ ] Add `expectTypeOf` from `vitest` and `elemMatch`, `not`, `or`, `seal` from `../../../src`, then add these declarations after `CustomValue`:

```typescript
interface ISealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'sealed';
    readonly sealed: true;
    seal(): ISealedCustomCondition;
}

interface IUnsealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'unsealed';
    seal(): ISealedCustomCondition;
}
```

- [ ] Add these tests inside the existing `describe` in `condition-contract.spec.ts`:

```typescript
it('should accept a custom condition in every composition helper', () => {
    const condition = new CustomCondition({ scope: 'tenant-a' });

    expect(and(condition).value).toEqual([condition]);
    expect(or(condition).value).toEqual([condition]);
    expect(not(condition).value).toEqual([condition]);
    expect(elemMatch('items', condition).value).toBe(condition);
});

it('should seal custom conditions polymorphically', () => {
    const condition = new CustomCondition({ scope: 'tenant-a' });
    const output = seal(condition);

    expectTypeOf(output).toEqualTypeOf<CustomCondition>();
    expect(output).not.toBe(condition);
    expect(output.sealed).toBe(true);
    expect(seal(output)).toBe(output);
});

it('should derive the helper result from the implementation seal method', () => {
    const assertReturnType = (condition: IUnsealedCustomCondition) => {
        const output = seal(condition);

        expectTypeOf(output).toEqualTypeOf<ISealedCustomCondition>();
    };

    expectTypeOf(assertReturnType).toBeFunction();
});

it('should seal a custom condition injected into a built-in group', () => {
    const condition = new CustomCondition({ scope: 'tenant-a' });
    const receiver = new Filters(FilterCompoundOperator.AND, [eq('name', 'Peter')]);

    const withAnd = receiver.and(condition);
    const withOr = receiver.or(condition);

    expect(withAnd.value[1]).toEqual(condition.seal());
    expect(withOr.value[1]).toEqual(condition.seal());
    expect(withAnd.value[1]).not.toBe(condition);
    expect(withOr.value[1]).not.toBe(condition);
});

it('should keep detached runtime data unchanged when it has no seal method', () => {
    const detached = {
        operator: 'custom',
        value: { scope: 'tenant-a' },
    };

    expect(seal(detached as unknown as ICondition)).toBe(detached);
});
```

### Step 2: Run the red phase and inspect the expected failures

- [ ] Run:

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
npm run test --workspace=packages/core -- test/unit/parameter/condition-contract.spec.ts
```

Expected type failures: `and`, `or`, `not`, and `elemMatch` reject `CustomCondition` because they expose the private `ConditionNode` union. Expected runtime failures: standalone and injected sealing return or store the original unsealed custom condition.

### Step 3: Remove `ConditionNode` and use the open contract

- [ ] In `helpers/module.ts`, delete the `IFilter`/`IFilters` imports and the private alias, import `ICondition`, and use these signatures:

```typescript
export function elemMatch<RECORD extends ObjectLiteral = ObjectLiteral>(
    field: FieldKey<RECORD>,
    value: ICondition,
): Filter {
    return new Filter(FilterFieldOperator.ELEM_MATCH, field, value);
}

export function and(...conditions: ICondition[]): Filters {
    return new Filters(FilterCompoundOperator.AND, conditions);
}

export function or(...conditions: ICondition[]): Filters {
    return new Filters(FilterCompoundOperator.OR, conditions);
}

export function not(...conditions: ICondition[]): Filters {
    return new Filters(FilterCompoundOperator.NOT, conditions);
}
```

There must be no replacement alias between the helpers and `ICondition`.

### Step 4: Delegate standalone sealing polymorphically

- [ ] Replace the guard-specific implementation and stale node-kind explanation in `seal.ts` with:

```typescript
export function seal<T extends ICondition>(
    condition: T,
): ReturnType<T['seal']>;
export function seal(condition: ICondition): ICondition {
    if (typeof condition.seal === 'function') {
        return condition.seal();
    }

    return condition;
}
```

The callable check is deliberate even though TypeScript declares the method: explicitly cast detached runtime data may not actually have it. Update TSDoc to say every live `ICondition` owns its immutable copy and detached runtime data is left unchanged.

### Step 5: Delegate wrap-and-inject sealing polymorphically

- [ ] Replace `sealCondition` in `collection/module.ts` with:

```typescript
function sealCondition(condition: ICondition): ICondition {
    if (typeof condition.seal === 'function') {
        return condition.seal();
    }

    return condition;
}
```

Remove imports used only by the old guard-specific seal implementation. Keep `isFilter` and `isFilters` imports that are still required by merge and flatten.

### Step 6: Preserve the runtime-boundary regression

- [ ] In `merge.spec.ts`, import `ICondition` as a type and revise the detached-data test:

```typescript
it('should leave detached runtime data without a seal method untouched', () => {
    const detached = { operator: 'and', value: [] };

    expect(seal(detached as unknown as ICondition)).toBe(detached);
});
```

### Step 7: Run green checks and commit

- [ ] Run:

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
npm run test --workspace=packages/core -- test/unit/parameter/condition-contract.spec.ts
npm run test --workspace=packages/core
```

Expected: all commands exit 0, custom helper acceptance compiles, both custom sealing paths pass, and detached runtime data stays unchanged.

- [ ] Inspect the public surface and diff:

```bash
rg -n "ConditionNode|IFilter \| IFilters" packages/core/src/parameter/filters
git diff --check
git diff -- packages/core/src/parameter/filters packages/core/test/unit/parameter
```

Expected: the first command has no matches; `git diff --check` is silent.

- [ ] Commit:

```bash
git add packages/core/src/parameter/filters packages/core/test/unit/parameter/condition-contract.spec.ts packages/core/test/unit/parameter/merge.spec.ts
git commit -m "fix(core)!: support custom condition composition"
```

---

## Task 3: Document the Extension Contract and Consumer Boundary

**Files:**

- Modify: `packages/docs/guide/building-queries.md:69-105`
- Modify: `packages/docs/guide/merging-queries.md:58-86`
- Modify: `packages/docs/guide/query-ast.md:45-65`
- Modify: `packages/docs/packages/adapter-memory.md:50-61`
- Modify: `.agents/architecture.md:27-34,49-54,65-93`

### Step 1: Document structural custom conditions

- [ ] After the condition-helper list in `building-queries.md`, add a subsection named `#### Custom conditions` with this example:

```typescript
import type { ICondition, IConditionVisitor } from '@rapiq/core';
import { and, eq } from '@rapiq/core';

interface GeoVisitor<R> {
    visitGeo(condition: GeoCondition): R;
}

class GeoCondition implements ICondition<[number, number]> {
    readonly operator = 'geo';

    constructor(
        readonly value: [number, number],
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

const filters = and(
    eq('active', true),
    new GeoCondition([52.52, 13.405]),
);
```

Explain directly below it:

- `ICondition` is open and structural; extending `Condition`, `IFilter`, or `IFilters` is not required.
- `accept()` supplies both the custom specialized path and the generic fallback.
- `seal()` returns an immutable protected copy and should preserve the concrete type.
- a custom condition needs a parser/adapter/consumer that understands it; built-in adapters intentionally reject unknown condition kinds.

### Step 2: Document polymorphic sealing and detached data

- [ ] Extend the `seal` section in `merging-queries.md` with these facts:

```markdown
Every live `ICondition` owns this operation through `seal()`. The standalone
helper and `Filters.and()` / `Filters.or()` call that method polymorphically, so
custom structural conditions receive the same non-displaceability guarantee as
built-in leaves and groups.

`ICondition` describes a live AST object, not serialized `{ operator, value }`
data: it also requires `accept()` and `seal()`. After JSON, RPC, or cache
transport, parse, decode, or rebuild the condition before composition. Runtime
data admitted through JavaScript, `any`, or an explicit cast is left unchanged
when no callable `seal` exists; a built-in adapter still rejects an unknown
detached condition rather than silently dropping it.
```

### Step 3: Document generic visitor fallback and adapter ownership

- [ ] In `query-ast.md`, expand the visitor interfaces to:

```typescript
interface IConditionVisitor<R> {
    visitCondition(condition: ICondition): R;
}

interface IFiltersVisitor<R> {
    visitFilters(filters: IFilters): R;
}

interface IFilterVisitor<R> {
    visitFilter(filter: IFilter): R;
}
```

Explain that built-ins prefer their specialized method and fall back to `visitCondition`, while a custom kind may expose its own specialized overload plus `IConditionVisitor`. State that built-in kind guards probe double dispatch, so arbitrary property names do not cause a custom condition to be treated as a leaf or group.

- [ ] In `adapter-memory.md`, replace any claim that built-in compilation understands arbitrary `ICondition` implementations with: `compileFilters` accepts the open type because custom consumers can share the AST contract, but the bundled memory compiler lowers built-in `Filter` / `Filters` semantics only and throws `CONDITION_DETACHED` for an unknown custom kind.

### Step 4: Record the architecture decision for future agents

- [ ] Update `.agents/architecture.md` in the filter composition and visitor sections to record:

```markdown
`ICondition` is the open, structural filter extension contract: every live
condition provides generic visitor fallback dispatch (`IConditionVisitor`) and
polymorphic immutable `seal()`. Built-in `Filter` / `Filters` retain specialized
visitor overloads and are identified through dispatch rather than member names.
Helpers and injection accept `ICondition` directly; custom kinds remain opaque
to built-in flatten/merge logic and require a consumer that understands them.
Detached `{ operator, value }` data is not an `ICondition` until rehydrated.
```

Integrate the paragraph into the existing prose rather than leaving a detached duplicate block.

### Step 5: Verify docs and commit

- [ ] Run:

```bash
npm run build --workspace=packages/docs
npm run lint
git diff --check
```

Expected: docs build and lint exit 0; all new links and TypeScript snippets render; `git diff --check` is silent.

- [ ] Search for stale claims:

```bash
rg -n "declares only|neither node kind|ConditionNode|children are either leaf|any condition node or ICondition" packages/docs .agents packages/core/src/parameter/filters
```

Review every match and remove or qualify claims that close the extension set or describe `ICondition` as data-only.

- [ ] Commit:

```bash
git add packages/docs/guide/building-queries.md packages/docs/guide/merging-queries.md packages/docs/guide/query-ast.md packages/docs/packages/adapter-memory.md .agents/architecture.md
git commit -m "docs(core): document custom condition contract"
```

---

## Task 4: Verify the Public Declaration and Entire Monorepo

**Files:**

- Verify only; modify issue-related code or docs only if a check exposes a real defect.

### Step 1: Verify core types, tests, and emitted declarations

- [ ] Run:

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
npm run test --workspace=packages/core
npx nx run @rapiq/core:build
```

Expected: all commands exit 0.

- [ ] Inspect the declaration bundle:

```bash
rg -n "IConditionVisitor|interface ICondition|accept<R>|seal\(\)|and\(\.\.\.conditions|or\(\.\.\.conditions|ConditionNode" packages/core/dist/index.d.mts
```

Expected:

- `IConditionVisitor` and behavioral `ICondition` are exported.
- `IFilter` and `IFilters` expose specialized and generic `accept()` overloads.
- helpers and collection combinators accept `ICondition`.
- `seal()` preserves the concrete implementation's declared return type.
- `ConditionNode` is absent.

### Step 2: Run repository-wide verification

- [ ] Run each command separately and retain the output:

```bash
npm run lint
npm run build
npm test
npm run build --workspace=packages/docs
```

Expected: every command exits 0. Do not report success from cached status alone; inspect the Nx summary and test counts.

### Step 3: Audit scope and commit state

- [ ] Run:

```bash
git diff --check master...HEAD
git status --short --branch
git log --oneline --decorate master..HEAD
git diff --stat master...HEAD
git diff master...HEAD -- packages/core/src packages/core/test packages/docs .agents docs/superpowers
```

Expected: the worktree is clean, commits are conventional, and every changed file belongs to the design, plan, implementation, tests, docs, or agent architecture update for #885/#886.

- [ ] Confirm the behavioral invariants one final time:

```bash
rg -n "ConditionNode|type .*IFilter.*IFilters|interface ICondition" packages/core/src packages/core/dist/index.d.mts
```

Expected: there is one open `ICondition` contract and no closed node union.

### Step 4: Request review and prepare integration choices

- [ ] Use the `superpowers:requesting-code-review` skill to review the full `master...HEAD` diff against:

- issue #885's public condition-type requirement;
- issue #886's detached-data safety requirement;
- the approved open extension design in `docs/superpowers/specs/2026-08-06-condition-contract-design.md`;
- the custom structural condition and visitor/sealing tests in this plan.

- [ ] Fix any confirmed issue with a new red test first, rerun the proportionate focused checks, then repeat the full verification commands above.

- [ ] When the review is clean and verification is fresh, use `superpowers:finishing-a-development-branch` to present the integration options. Do not merge, push, or open a PR without the user's choice.

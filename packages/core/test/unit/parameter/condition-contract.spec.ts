/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expectTypeOf } from 'vitest';
import type {
    ICondition,
    IFilter,
    IFilters,
} from '../../../src';
import {
    Condition,
    FilterCompoundOperator,
    Filters,
    and,
    elemMatch,
    eq,
    isCondition,
    isFilter,
    isFilters,
    not,
    or,
    seal,
} from '../../../src';

type CustomValue = {
    scope: string,
};

interface ISealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'sealed';
    readonly sealed: true;
    seal(): ISealedCustomCondition;
}

interface IUnsealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'unsealed';
    seal(): ISealedCustomCondition;
}

class CustomCondition extends Condition<CustomValue> {
    readonly field: string;

    constructor(
        value: CustomValue,
        sealed?: boolean,
        operator = 'custom',
        field = 'not-a-built-in-leaf',
    ) {
        super(operator, value, { sealed });
        this.field = field;
    }

    seal(): ICondition<CustomValue> {
        return this.sealed ? this : new CustomCondition(this.value, true);
    }

    flatten(): this {
        return this;
    }
}

describe('src/parameter/filters condition contract', () => {
    it('should identify conditions through a non-serializable brand', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const detached = JSON.parse(JSON.stringify(condition));

        expect(isCondition(condition)).toBe(true);
        expect(isCondition(detached)).toBe(false);
        expect(isCondition({
            operator: 'custom',
            value: {},
            seal() { return this; },
        })).toBe(false);
    });

    it('should retain specialized visitor dispatch for built-in conditions', () => {
        const leaf = eq('name', 'Peter');
        const group = and(eq('active', true));

        expect(leaf.accept({ visitFilter: (condition) => condition.operator })).toBe('eq');
        expect(group.accept({ visitFilters: (condition) => condition.operator })).toBe('and');
    });

    it('should not require visitor dispatch from a structural custom condition', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        type HasAccept = 'accept' extends keyof ICondition ? true : false;

        expectTypeOf<HasAccept>().toEqualTypeOf<false>();
        expect(condition.value.scope).toBe('tenant-a');
    });

    it('should discriminate built-in kinds by dispatch rather than member names', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(isFilter(condition)).toBe(false);
        expect(isFilters(condition)).toBe(false);
    });

    it('should accept a custom condition in every composition helper', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(and(condition).value).toEqual([condition]);
        expect(or(condition).value).toEqual([condition]);
        expect(not(condition).value).toEqual([condition]);
        expect(elemMatch('items', condition).value).toBe(condition);
    });

    it('should expose interfaces from seal contracts', () => {
        const leaf = eq('name', 'Peter');
        const group = and(leaf);

        expectTypeOf(leaf.seal()).toEqualTypeOf<IFilter>();
        expectTypeOf(group.seal()).toEqualTypeOf<IFilters>();
        expectTypeOf(seal(leaf)).toEqualTypeOf<IFilter>();
        expectTypeOf(seal(group)).toEqualTypeOf<IFilters>();
    });

    it('should seal custom conditions polymorphically behind the interface', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const output = seal(condition);

        expectTypeOf(output).toEqualTypeOf<ICondition<CustomValue>>();
        expect(output).not.toBe(condition);
        expect(output.sealed).toBe(true);
        expect(seal(output)).toBe(output);
    });

    it('should derive the helper result from the declared seal interface', () => {
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

    it('should keep a custom condition opaque while flattening built-in groups', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' }, false, 'and');
        const output = and(and(condition)).flatten();

        expect(output.value).toHaveLength(1);
        expect(output.value.at(0)).toBe(condition);
    });

    it('should carry a custom condition through a built-in merge unchanged', () => {
        const condition = new CustomCondition(
            { scope: 'tenant-a' },
            false,
            'custom',
            'name',
        );
        const receiver = and(eq('name', 'Peter'));
        const output = receiver.merge(and(condition));

        expect(output.value).toHaveLength(2);
        expect(output.value[1]).toBe(condition);
    });

    it('should keep detached runtime data unchanged when it has no seal method', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        expect(seal(detached as unknown as ICondition)).toBe(detached);
    });

    it('should reject detached data at typed condition boundaries', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        // @ts-expect-error detached data has no sealing behavior
        const condition: ICondition = detached;
        // @ts-expect-error helpers accept live ICondition implementations
        and(detached);
        // @ts-expect-error injection accepts live ICondition implementations
        new Filters(FilterCompoundOperator.AND, []).and(detached);

        expect(condition).toBe(detached);
    });
});

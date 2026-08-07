/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expectTypeOf } from 'vitest';
import type {
    ICondition,
} from '../../../src';
import {
    CONDITION_MARKER,
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
} from '../../../src';

type CustomValue = {
    scope: string,
};

class CustomCondition extends Condition<CustomValue> {
    readonly field: string;

    constructor(
        value: CustomValue,
        operator = 'custom',
        field = 'not-a-built-in-leaf',
    ) {
        super(operator, value);
        this.field = field;
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
        expect(Object.hasOwn(condition, CONDITION_MARKER)).toBe(false);
        expect(Object.getOwnPropertyDescriptor(
            Condition.prototype,
            CONDITION_MARKER,
        )?.enumerable).toBe(false);
        expect(isCondition({ [CONDITION_MARKER]: true })).toBe(false);
        expect(isCondition({
            operator: 'custom',
            value: {},
        })).toBe(false);

        // the brand is asserted, not merely present.
        expect(isCondition({
            [CONDITION_MARKER]: false,
            operator: 'custom',
            value: {},
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
        type HasSeal = 'seal' extends keyof ICondition ? true : false;
        type HasSealed = 'sealed' extends keyof ICondition ? true : false;

        expectTypeOf<HasAccept>().toEqualTypeOf<false>();
        expectTypeOf<HasSeal>().toEqualTypeOf<false>();
        expectTypeOf<HasSealed>().toEqualTypeOf<false>();
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

    it('should combine custom conditions without cloning or preserving them', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const receiver = and(eq('name', 'Peter'));

        expect(receiver.and(condition).value.at(-1)).toBe(condition);
        expect(receiver.or(condition).value.at(-1)).toBe(condition);
        expect('preserved' in condition).toBe(false);
    });

    it('should keep a custom condition opaque while flattening built-in groups', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' }, 'and');
        const output = and(and(condition)).flatten();

        expect(output.value).toHaveLength(1);
        expect(output.value.at(0)).toBe(condition);
    });

    it('should carry a custom condition through a built-in merge unchanged', () => {
        const condition = new CustomCondition(
            { scope: 'tenant-a' },
            'custom',
            'name',
        );
        const receiver = and(eq('name', 'Peter'));
        const output = receiver.merge(and(condition));

        expect(output.value).toHaveLength(2);
        expect(output.value[1]).toBe(condition);
    });

    it('should reject detached data at typed condition boundaries', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        // @ts-expect-error detached data has no condition brand
        const condition: ICondition = detached;
        // @ts-expect-error helpers accept live ICondition implementations
        and(detached);
        // @ts-expect-error injection accepts live ICondition implementations
        new Filters(FilterCompoundOperator.AND, []).and(detached);

        expect(condition).toBe(detached);
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '../../../src';
import {
    AdapterError,
    BuildError,
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    defineFilters,
    elemMatch,
    eq,
    planCondition,
} from '../../../src';

/**
 * `ICondition` declares only `{ operator, value }`, while the node
 * guards duck-type on the `accept` method. A condition that made a
 * JSON round trip therefore satisfies the declared type but is not a
 * node — it must fail loudly rather than be dropped from a compound
 * (which silently widens the result set) or be reinterpreted as a
 * record of field/value pairs.
 */
const NON_NODE : ICondition = {
    operator: 'eq',
    value: 'ACME',
};

describe('src/parameter/filters (non-node conditions)', () => {
    it('should refuse to lower a non-node child of a compound', () => {
        const condition = new Filters(FilterCompoundOperator.AND, [
            eq('name', 'John'),
            NON_NODE,
        ]);

        expect(() => planCondition(condition)).toThrow(AdapterError);
    });

    it('should refuse to lower a non-node at the root, as before', () => {
        expect(() => planCondition(NON_NODE)).toThrow(AdapterError);
    });

    it('should not silently drop the non-node conjunct', () => {
        const condition = new Filters(FilterCompoundOperator.AND, [
            eq('name', 'John'),
            NON_NODE,
        ]);

        // the failure mode this guards: lowering to the `name` leaf alone
        expect(() => planCondition(condition)).toThrow(AdapterError);
    });

    it('should refuse a detached elemMatch interior as detached, not unsupported', () => {
        try {
            planCondition(elemMatch('items', NON_NODE as any));
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toBe(ErrorCode.CONDITION_DETACHED);
        }
    });

    it('should still refuse a non-condition elemMatch interior as unsupported', () => {
        for (const interior of ['nonsense', 42, null, [], { a: 1 }]) {
            try {
                planCondition(elemMatch('items', interior as any));
                expect.fail('should have thrown');
            } catch (e) {
                expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
            }
        }
    });

    it('should refuse a non-node condition passed to defineFilters', () => {
        expect(() => defineFilters(NON_NODE)).toThrow(BuildError);
    });

    it('should still accept a real node in defineFilters', () => {
        expect(() => defineFilters(eq('name', 'John'))).not.toThrow();
    });

    it('should still accept a plain build input record', () => {
        const output = defineFilters({ name: 'John' });

        expect(output.value).toHaveLength(1);
    });

    it('should not mistake a record field named operator for a condition', () => {
        // a legitimate build input may carry a column called `operator`
        const output = defineFilters({ operator: 'eq', name: 'John' });

        expect(output.value).toHaveLength(2);
    });

    /**
     * A real condition always carries its operand, so requiring one keeps
     * the guard from swallowing a single-column record filter.
     */
    it('should accept a record filtering only on a column named operator', () => {
        const output = defineFilters({ operator: 'eq' });

        expect(output.value).toHaveLength(1);
    });

    it('should accept a record filtering only on a column named value', () => {
        const output = defineFilters({ value: 'eq' });

        expect(output.value).toHaveLength(1);
    });

    it('should still refuse a detached leaf carrying field but no value', () => {
        // `eq('x', undefined)` loses `value` to JSON, keeping `field`
        expect(() => defineFilters({ operator: 'eq', field: 'x' } as ICondition))
            .toThrow(BuildError);
    });
});

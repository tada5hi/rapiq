/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AGGREGATE_FUNCTION_SLOTS,
    AggregateFunction,
    BucketUnit,
    GROUP_FUNCTION_SLOTS,
    GroupFunction,
} from '../../../src';

describe('src/parameter/call/constants.ts', () => {
    it('should declare the v1 primitives and bucket units', () => {
        expect(Object.values(GroupFunction)).toEqual(['bucket']);
        expect(Object.values(AggregateFunction)).toEqual(['count', 'sum']);
        expect(Object.values(BucketUnit)).toEqual(['hour', 'day', 'month']);
    });

    it('should declare the bucket slots in wire order', () => {
        expect(GROUP_FUNCTION_SLOTS[GroupFunction.BUCKET]).toEqual([
            { name: 'field', optional: false },
            { name: 'unit', optional: false },
        ]);
    });

    it('should make only the field of count optional', () => {
        expect(AGGREGATE_FUNCTION_SLOTS[AggregateFunction.COUNT]).toEqual([
            { name: 'field', optional: true },
        ]);
        expect(AGGREGATE_FUNCTION_SLOTS[AggregateFunction.SUM]).toEqual([
            { name: 'field', optional: false },
        ]);
    });
});

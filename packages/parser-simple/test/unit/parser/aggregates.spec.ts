/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { flattenIssueItems } from '@ebec/core';
import {
    Aggregate,
    Aggregates,
    AggregatesParseError,
    ErrorCode,
    ErrorMessage,
} from '@rapiq/core';
import { SimpleAggregatesParser } from '../../../src';
import { registry } from '../../data';

function errorOf(run: () => unknown) : AggregatesParseError | undefined {
    try {
        run();
    } catch (e) {
        return e as AggregatesParseError;
    }

    return undefined;
}

describe('src/parameter/aggregates', () => {
    const parser = new SimpleAggregatesParser(registry);

    it('should derive one key per term without an alias syntax', () => {
        const output = parser.parse(
            'count,count(couponId),sum(amount),total(amount),total(fee),revenue',
            { schema: 'event' },
        );

        expect(output.value.map((item) => item.key)).toEqual([
            'count',
            'countCouponId',
            'sumAmount',
            'totalAmount',
            'totalFee',
            'revenue',
        ]);
        expect(output.value.map((item) => item.lowering)).toEqual([
            {
                fn: 'count',
                field: undefined,
                args: [],
            },
            {
                fn: 'count',
                field: 'couponId',
                args: [],
            },
            {
                fn: 'sum',
                field: 'amount',
                args: [],
            },
            {
                fn: 'sum',
                field: 'amount',
                args: [],
            },
            {
                fn: 'sum',
                field: 'fee',
                args: [],
            },
            {
                fn: 'sum',
                field: 'amount',
                args: [],
            },
        ]);
    });

    it('should keep the wire form on the node', () => {
        expect(parser.parse('total(fee)', { schema: 'event' })).toEqual(new Aggregates([
            new Aggregate({
                name: 'total',
                params: ['fee'],
                lowering: {
                    fn: 'sum',
                    field: 'fee',
                    args: [],
                },
            }),
        ]));
    });

    it('should resolve primitives without a schema', () => {
        expect(parser.parse('count,sum(amount)').value.map((item) => item.key))
            .toEqual(['count', 'sumAmount']);
    });

    it('should reject count and count() together', () => {
        const error = errorOf(() => parser.parse('count,count()', { schema: 'event' }));

        expect(error).toBeInstanceOf(AggregatesParseError);
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([expect.objectContaining({
            code: ErrorCode.KEY_AMBIGUOUS,
            path: ['count'],
            message: ErrorMessage.outputKeyDuplicate('count'),
        })]);
    });

    it('should reject an input of the wrong shape', () => {
        const error = errorOf(() => parser.parse(5, { schema: 'event' }));

        expect(error).toBeInstanceOf(AggregatesParseError);
        expect(flattenIssueItems([...(error?.issues ?? [])])).toEqual([
            expect.objectContaining({ code: ErrorCode.INPUT_INVALID }),
        ]);
    });
});

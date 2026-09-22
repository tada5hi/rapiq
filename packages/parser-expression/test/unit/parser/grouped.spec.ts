/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregates,
    ErrorCode,
    Groups,
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import { ExpressionParser } from '../../../src';
import { expectRejected } from '../../data';

const INPUT = {
    groups: 'bucket(createdAt,day),scope',
    aggregates: 'count,sum(amount)',
    sorts: '-count',
    pagination: { limit: 10 },
};

const OPT_IN = { groups: true, aggregates: true };

describe('src/module.ts: groups and aggregates', () => {
    const parser = new ExpressionParser();

    it('should parse them exactly like the simple dialect', () => {
        const query = parser.parse(INPUT, OPT_IN);

        expect(query).toEqual(new SimpleParser().parse(INPUT, OPT_IN));
        expect(query.groups.value.map((item) => item.key)).toEqual(['bucket', 'scope']);
        expect(query.aggregates.value.map((item) => item.key)).toEqual(['count', 'sum_amount']);
        expect(query.sorts).toEqual(new Sorts([new Sort('count', SortDirection.DESC)]));
    });

    it('should parse them asynchronously', async () => {
        await expect(parser.parseAsync(INPUT, OPT_IN)).resolves.toEqual(parser.parse(INPUT, OPT_IN));
    });

    it('should ignore them unless the parse opts in', () => {
        const query = parser.parse(INPUT);

        expect(query.groups).toEqual(new Groups());
        expect(query.aggregates).toEqual(new Aggregates());
    });

    it('should reject an unknown callee', () => {
        expectRejected(() => parser.parse({ aggregates: 'avg(amount)' }, OPT_IN), { code: ErrorCode.OPERATOR_UNSUPPORTED });
    });
});

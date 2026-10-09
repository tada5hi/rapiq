/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    ErrorCode,
    Group,
    Groups,
    Query,
} from '@rapiq/core';
import { Adapter, pg } from '../../src';

const refusal = expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED, feature: 'groups' });

describe('src/adapter/module.ts (grouped queries)', () => {
    it('should refuse a query with groups', () => {
        const query = new Query({
            groups: new Groups([new Group({
                name: 'scope',
                lowering: {
                    fn: undefined,
                    field: 'scope',
                    args: [],
                },
            })]),
        });

        expect(() => new Adapter(pg).execute(query)).toThrowError(refusal);
    });

    it('should refuse a query with aggregates only', () => {
        const query = new Query({
            aggregates: new Aggregates([new Aggregate({
                name: 'count',
                lowering: {
                    fn: 'count',
                    field: undefined,
                    args: [],
                },
            })]),
        });

        expect(() => new Adapter(pg).execute(query)).toThrowError(refusal);
    });

    it('should keep executing a plain query', () => {
        expect(new Adapter(pg).execute(new Query()).params).toEqual([]);
    });
});

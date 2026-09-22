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
import { applyQuery, compileQuery } from '../../src';

const refusal = expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED, feature: 'groups' });

describe('src/module.ts (grouped queries)', () => {
    const grouped = new Query({
        groups: new Groups([new Group({
            name: 'scope',
            lowering: {
                fn: undefined,
                field: 'scope',
                args: [],
            },
        })]),
    });
    const aggregated = new Query({
        aggregates: new Aggregates([new Aggregate({
            name: 'count',
            lowering: {
                fn: 'count',
                field: undefined,
                args: [],
            },
        })]),
    });

    it('should refuse to compile a grouped query', () => {
        expect(() => compileQuery(grouped)).toThrowError(refusal);
        expect(() => compileQuery(aggregated)).toThrowError(refusal);
    });

    it('should refuse to apply a grouped query', () => {
        expect(() => applyQuery(grouped, [{ scope: 'a' }])).toThrowError(refusal);
    });

    it('should keep applying a plain query', () => {
        expect(applyQuery(new Query(), [{ scope: 'a' }]).data).toEqual([{ scope: 'a' }]);
    });
});

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
import { PrismaAdapter } from '../../src';
import { createAdapterOptions } from '../data/schema';

const refusal = expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED, feature: 'groups' });

describe('src/adapter/module.ts (grouped queries)', () => {
    const grouped = new Query({
        groups: new Groups([new Group({
            name: 'age',
            lowering: {
                fn: undefined,
                field: 'age',
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

    it('should refuse to serialize a grouped query', () => {
        const adapter = new PrismaAdapter(createAdapterOptions());

        expect(() => adapter.execute(grouped)).toThrowError(refusal);
        expect(() => adapter.execute(aggregated)).toThrowError(refusal);
    });

    it('should reject a grouped query in the runners', async () => {
        // unbound on purpose: the unbound refusal carries no feature tag,
        // so matching feature 'groups' proves the grouped guard ran first.
        const adapter = new PrismaAdapter(createAdapterOptions());

        await expect(adapter.findMany(grouped)).rejects.toThrowError(refusal);
        await expect(adapter.count(aggregated)).rejects.toThrowError(refusal);
    });
});

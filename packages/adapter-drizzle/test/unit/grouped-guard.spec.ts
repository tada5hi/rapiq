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
import { createAdapterOptions } from '../data';
import { DrizzleAdapter, buildDrizzleConfig } from '../../src';

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
        const adapter = new DrizzleAdapter(createAdapterOptions());

        expect(() => adapter.execute(grouped)).toThrowError(refusal);
        expect(() => adapter.execute(aggregated)).toThrowError(refusal);
    });

    it('should refuse through the one-shot helper', () => {
        expect(() => buildDrizzleConfig(grouped, createAdapterOptions())).toThrowError(refusal);
    });
});

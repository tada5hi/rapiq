/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    SchemaRegistry,
    defineSchema,
    eq,
} from '@rapiq/core';
import { createURLCodec } from '../../src';

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    flag: boolean,
};

const buildRegistry = () => {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Row>({
        name: 'row',
        indexes: [['realm_id', 'created_at']],
        filters: { indexed: true, default: eq('flag', true) },
    }));

    return registry;
};

describe('indexed schemas', () => {
    it('should enforce the index policy on decode', () => {
        const codec = createURLCodec(buildRegistry());

        const anchored = codec.decode("filter=eq(realm_id, 'x')", { schema: 'row' })!;
        expect(anchored.filters.value).toHaveLength(1);
        expect(anchored.filters.value).not.toEqual([eq('flag', true)]);

        const unanchored = codec.decode("filter=eq(created_at, 'x')", { schema: 'row' })!;
        expect(unanchored.filters.value).toEqual([eq('flag', true)]);
    });
});

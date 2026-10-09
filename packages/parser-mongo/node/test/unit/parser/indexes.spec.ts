/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    SchemaRegistry,
    defineSchema,
    eq,
} from '@rapiq/core';
import { MongoParser } from '../../../src';
import { expectRejected } from '../../data';

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    flag: boolean,
};

const buildRegistry = (throwOnFailure?: boolean) => {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Row>({
        name: 'row',
        throwOnFailure,
        indexes: [['realm_id', 'created_at']],
        filters: { indexed: true, default: eq('flag', true) },
    }));

    return registry;
};

describe('indexed schemas', () => {
    it('should keep an anchored document', () => {
        const parser = new MongoParser(buildRegistry());
        const output = parser.parseFilters({ realm_id: 'x', flag: true }, { schema: 'row' });

        expect(output.value.length).toBeGreaterThan(0);
        expect(output.value).not.toEqual([eq('flag', true)]);
    });

    it('should require every $or branch to anchor', () => {
        const parser = new MongoParser(buildRegistry());
        const output = parser.parseFilters(
            { $or: [{ realm_id: 'x' }, { flag: true }] },
            { schema: 'row' },
        );

        expect(output.value).toEqual([eq('flag', true)]);
    });

    it('should throw typed under throwOnFailure', () => {
        const parser = new MongoParser(buildRegistry(true));

        expectRejected(
            () => parser.parseFilters({ created_at: { $gte: 5 } }, { schema: 'row' }),
            { code: ErrorCode.KEY_COMBINATION_NOT_INDEXED },
        );
    });
});

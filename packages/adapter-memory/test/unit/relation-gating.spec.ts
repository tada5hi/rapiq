/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createURLCodec } from '@rapiq/codec-url';
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { applyQuery } from '../../src';

type Row = {
    id: number,
    realm?: { name: string },
    role?: { name: string }
};

/**
 * #1001: filtering through relation `realm` is gated by the schema, not
 * the include. The input rows carry both relations; only the included
 * one may be returned when fields are picked.
 */
describe('relation traversal gating (#1001)', () => {
    const registry = new SchemaRegistry();

    registry.add(defineSchema<Row>({
        name: 'user',
        fields: { allowed: ['id'] },
        filters: { allowed: ['id', 'realm.name'] },
        relations: { allowed: ['role', 'realm'] },
        sort: { allowed: ['id'] },
        schemaMapping: { realm: 'realm', role: 'role' },
    }));
    registry.add(defineSchema({ name: 'realm', filters: { allowed: ['name'] } }));
    registry.add(defineSchema({ name: 'role', filters: { allowed: ['name'] } }));

    const codec = createURLCodec(registry);

    const rows : Row[] = [
        {
            id: 1, 
            realm: { name: 'master' }, 
            role: { name: 'admin' }, 
        },
        {
            id: 2, 
            realm: { name: 'other' }, 
            role: { name: 'admin' }, 
        },
        {
            id: 3, 
            realm: { name: 'master' }, 
            role: { name: 'admin' }, 
        },
    ];

    it('keeps a filter through a relation that is not the included one', () => {
        const query = codec.decode(
            { filter: { 'realm.name': 'master' }, include: 'role' },
            { schema: 'user' },
        )!;

        const output = applyQuery(query, rows);

        expect(output.data.map((row) => row.id)).toEqual([1, 3]);
        expect(output.total).toEqual(2);
    });

    it('keeps a filter through a relation without any include', () => {
        const query = codec.decode(
            { filter: { 'realm.name': 'other' } },
            { schema: 'user' },
        )!;

        expect(applyQuery(query, rows).data.map((row) => row.id)).toEqual([2]);
    });

    it('keeps only the included relation when fields are picked', () => {
        const query = codec.decode(
            {
                filter: { 'realm.name': 'master' }, 
                include: 'role', 
                fields: 'id', 
            },
            { schema: 'user' },
        )!;

        const output = applyQuery(query, rows);

        expect(output.data).toEqual([
            { id: 1, role: { name: 'admin' } },
            { id: 3, role: { name: 'admin' } },
        ]);
    });
});

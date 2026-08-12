/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { defineQuery } from '@rapiq/core';
import { createURLCodec } from '../../src';

describe('src/module.ts', () => {
    const codec = createURLCodec();

    it('should encode sorts to the sort wire parameter', () => {
        const output = codec.encode(defineQuery({ sorts: '-id' }));

        expect(output).toContain('sort=-id');
        expect(output).not.toContain('sorts=');
    });

    it('should encode both input spellings identically', () => {
        expect(codec.encode(defineQuery({ sorts: '-id' })))
            .toBe(codec.encode(defineQuery({ sort: '-id' })));
    });

    it('should round-trip a sorted query', () => {
        const query = codec.decode(codec.encode(defineQuery({ sorts: '-id' })));

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['id', 'DESC']]);
    });

    it('should honour either encode mask spelling', () => {
        const query = defineQuery({ sorts: '-id', fields: ['id'] });

        expect(codec.encode(query, { parameters: ['sorts'] })).toContain('sort=-id');
        expect(codec.encode(query, { parameters: ['sort'] })).toContain('sort=-id');
        expect(codec.encode(query, { parameters: ['fields'] })).not.toContain('sort=');
    });
});

/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    FiltersParseError,
    defineQuery,
    eq,
    gte,
    or,
} from '@rapiq/core';
import { URLEncoder } from '../../src';
import { registry } from '../data/schema';

describe('encoder (schema-aware)', () => {
    let encoder : URLEncoder;

    beforeAll(() => {
        encoder = new URLEncoder(registry);
    });

    it('should validate filters against the schema', () => {
        const query = defineQuery({
            filters: or(eq('name', 'John'), gte('id', 5)),
            sort: ['-id', 'secret'],
            relations: ['abc', 'passwords'],
        });

        const encoded = encoder.encode(query, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual(
            'filter=or(eq(name,\'John\'),gte(id,\'5\'))&include=items&sort=-id',
        );
    });

    it('should throw for a disallowed filter key (the expression dialect is precise)', () => {
        const query = defineQuery({ filters: eq('secret', 'x') });

        expect(() => encoder.encode(query, { schema: 'user' })).toThrowError(
            FiltersParseError,
        );
    });

    it('should resolve named schemas in per-parameter encodes', () => {
        const query = defineQuery({ sort: ['-id', 'secret'] });

        const encoded = encoder.encodeSort(query.sorts, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual('sort=-id');
    });
});

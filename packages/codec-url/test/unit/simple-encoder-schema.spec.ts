/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    ParseError,
    defineQuery,
    defineSchema,
    eq,
} from '@rapiq/core';
import { SimpleURLEncoder } from '../../src/simple';
import { registry } from '../data/schema';
import type { User } from '../data/type';

/**
 * Schema-aware encoding (plan 007 decision 3): the emitted output is
 * validated exactly the way the server-side decoder would treat it —
 * drop by default, schema-level throwOnFailure opts into throwing.
 */
describe('encoder (schema-aware)', () => {
    let encoder : SimpleURLEncoder;

    beforeAll(() => {
        encoder = new SimpleURLEncoder(registry);
    });

    it('should encode without a schema pass by default', () => {
        const query = defineQuery({
            fields: ['id', 'secret'],
            filters: { secret: 'x' },
        });

        expect(decodeURIComponent(encoder.encode(query)!)).toEqual(
            'fields=id,secret&filter[secret]=x',
        );
    });

    it('should drop disallowed keys across parameters', () => {
        const query = defineQuery({
            fields: ['id', 'secret'],
            filters: { name: 'John', secret: 'x' },
            relations: ['realm', 'passwords'],
            sort: ['-id', 'secret'],
        });

        const encoded = encoder.encode(query, { schema: 'user' });

        // included relations materialize their field groups, exactly as
        // the server-side decode of this input would resolve them.
        expect(decodeURIComponent(encoded!)).toEqual(
            'fields[__DEFAULT__]=id&fields[realm]=id,name,description&filter[name]=John&include=realm&sort=-id',
        );
    });

    it('should apply schema mappings to emitted keys', () => {
        const query = defineQuery({ relations: ['abc'] });

        const encoded = encoder.encode(query, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual('include=items');
    });

    it('should resolve relation paths through the registry', () => {
        const query = defineQuery({
            filters: eq('items.name', 'a'),
            relations: ['items'],
        });

        const encoded = encoder.encode(query, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual(
            'filter[items.name]=a&include=items',
        );
    });

    it('should clamp pagination to the schema maxLimit', () => {
        const schema = defineSchema<User>({ pagination: { maxLimit: 50 } });

        const query = defineQuery({ pagination: { limit: 500, offset: 10 } });

        const encoded = encoder.encode(query, { schema });

        expect(decodeURIComponent(encoded!)).toEqual(
            'page[limit]=50&page[offset]=10',
        );
    });

    it('should not materialize defaults for parameters absent from the input', () => {
        const schema = defineSchema<User>({ sort: { allowed: ['id', 'name'], default: { name: 'DESC' } } });

        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = encoder.encode(query, { schema });

        // the server applies its sort default on decode anyway —
        // validation must not fatten the wire with it.
        expect(decodeURIComponent(encoded!)).toEqual('filter[name]=John');
    });

    it('should throw when the schema opts into throwOnFailure', () => {
        const schema = defineSchema<User>({
            filters: { allowed: ['id', 'name'] },
            throwOnFailure: true,
        });

        const query = defineQuery({ filters: { secret: 'x' } });

        expect(() => encoder.encode(query, { schema })).toThrowError(ParseError);
    });

    it('should reject keys without an allow-list under strict mode', () => {
        const schema = defineSchema<User>({ filters: { allowed: ['id', 'name'] } });

        const query = defineQuery({
            filters: { name: 'John' },
            sort: '-id',
        });

        const encoded = encoder.encode(query, { schema, strict: true });

        expect(decodeURIComponent(encoded!)).toEqual('filter[name]=John');
    });

    it('should validate a single parameter through the same pass', () => {
        const query = defineQuery({ filters: { name: 'John', secret: 'x' } });

        const encoded = encoder.encodeFilters(query.filters, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual('filter[name]=John');
    });

    it('should await asynchronous validators in async encode methods', async () => {
        const schema = defineSchema<User>({
            filters: {
                validate: async (filter) => eq(
                    filter.field,
                    String(filter.value).toUpperCase(),
                ),
            },
        });
        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = await encoder.encodeAsync(query, { schema });
        const encodedFilters = await encoder.encodeFiltersAsync(query.filters, { schema });

        expect(decodeURIComponent(encoded!)).toEqual('filter[name]=JOHN');
        expect(decodeURIComponent(encodedFilters!)).toEqual('filter[name]=JOHN');
    });
});

/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SchemaError } from '@rapiq/core';
import {
    ErrorCode,
    FiltersParseError,
    defineQuery,
    defineSchema,
    eq,
    gte,
    or,
} from '@rapiq/core';
import { ExpressionURLEncoder } from '../../src/expression';
import { registry } from '../data/schema';

describe('encoder (schema-aware)', () => {
    let encoder : ExpressionURLEncoder;

    beforeAll(() => {
        encoder = new ExpressionURLEncoder(registry);
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

        const encoded = encoder.encodeSorts(query.sorts, { schema: 'user' });

        expect(decodeURIComponent(encoded!)).toEqual('sort=-id');
    });

    it('should await asynchronous validators in async encode methods', async () => {
        const schema = defineSchema({
            filters: {
                validate: async (filter) => eq(
                    filter.field,
                    String(filter.value).toUpperCase(),
                ),
            },
        });
        const query = defineQuery({ filters: eq('name', 'John') });

        const encoded = await encoder.encodeAsync(query, { schema });
        const encodedFilters = await encoder.encodeFiltersAsync(query.filters, { schema });

        expect(decodeURIComponent(encoded!)).toEqual('filter=eq(name,\'JOHN\')');
        expect(decodeURIComponent(encodedFilters!)).toEqual('filter=eq(name,\'JOHN\')');
    });

    it('should await asynchronous field validators through encodeFieldsAsync, and refuse them through the sync path', async () => {
        expect.assertions(2);

        const schema = defineSchema({ fields: { validate: async (name) => name !== 'secret' } });
        const query = defineQuery({ fields: ['id', 'secret'] });

        const encoded = await encoder.encodeFieldsAsync(query.fields, { schema });
        expect(decodeURIComponent(encoded!)).toEqual('fields=id');

        try {
            encoder.encodeFields(query.fields, { schema });
        } catch (e) {
            expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
        }
    });

    it('should await asynchronous relation validators through encodeRelationsAsync, and refuse them through the sync path', async () => {
        expect.assertions(2);

        const schema = defineSchema({ relations: { validate: async (name) => name === 'realm' } });
        const query = defineQuery({ relations: ['realm', 'items'] });

        const encoded = await encoder.encodeRelationsAsync(query.relations, { schema });
        expect(decodeURIComponent(encoded!)).toEqual('include=realm');

        try {
            encoder.encodeRelations(query.relations, { schema });
        } catch (e) {
            expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
        }
    });

    it('should await asynchronous sort validators through encodeSortsAsync, and refuse them through the sync path', async () => {
        expect.assertions(2);

        const schema = defineSchema({ sorts: { validate: async (name) => name !== 'name' } });
        const query = defineQuery({ sort: ['id', 'name'] });

        const encoded = await encoder.encodeSortsAsync(query.sorts, { schema });
        expect(decodeURIComponent(encoded!)).toEqual('sort=id');

        try {
            encoder.encodeSorts(query.sorts, { schema });
        } catch (e) {
            expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
        }
    });
});

/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    CodecError,
    ErrorCode,
    Filters,
    FiltersParseError,
    SchemaRegistry,
    defineQuery,
    defineSchema,
    eq,
    gte,
    or,
} from '@rapiq/core';
import type { IQuery } from '@rapiq/core';
import {
    URLCodec,
    URL_SIMPLE_CODEC,
    createURLCodec,
} from '../../src';

describe('URLCodec', () => {
    const codec = createURLCodec();

    it('should encode expressions and stamp their identity by default', () => {
        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = codec.encode(query);

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-expression&filter=eq(name,\'John\')',
        );
    });

    it('should retain explicit simple encoding during the v2 migration', () => {
        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = codec.encode(query, { codec: URL_SIMPLE_CODEC });

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-simple&filter[name]=John',
        );
        expect(codec.decode(encoded!)!.filters).toEqual(
            new Filters('and', [eq('name', 'John')]),
        );
    });

    it('should dispatch decoding on the stamped identity', () => {
        const query = defineQuery({ filters: or(eq('name', 'John'), gte('age', 18)) });

        const decoded = codec.decode(codec.encode(query)!);

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
    });

    it('should recognize unstamped legacy simple payloads', () => {
        const decoded = codec.decode('filter[name]=John');

        expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'John')]));
    });

    it('should recognize unstamped expression payloads', () => {
        const decoded = codec.decode('filter=or(eq(name,\'John\'),gte(age,\'18\'))');

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
    });

    it('should tolerate an untagged empty filter parameter', () => {
        const decoded = codec.decode('filter=&sort=-name');

        expect(decoded!.filters.value).toHaveLength(0);
        expect(decoded!.sorts.value).toHaveLength(1);
    });

    it('should fail loudly for an untagged non-expression filter string', () => {
        expect(() => codec.decode('filter=John')).toThrowError(FiltersParseError);
    });

    it('should fail loudly for a repeated untagged expression filter', () => {
        expect(() => codec.decode('filter=eq(name,\'a\')&filter=eq(name,\'b\')'))
            .toThrowError(FiltersParseError);
    });

    it('should treat an empty codec stamp as absent', () => {
        const decoded = codec.decode('codec=&filter[name]=John');

        expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'John')]));
    });

    it('should omit the identity stamp on request', () => {
        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = codec.encode(query, { stamp: false });

        expect(decodeURIComponent(encoded!)).toEqual('filter=eq(name,\'John\')');
        expect(codec.decode(encoded!)!.filters).toEqual(
            new Filters('and', [eq('name', 'John')]),
        );
    });

    it('should let a registered detect hook claim untagged payloads', () => {
        const seen : unknown[] = [];

        const external = new URLCodec();
        external.register({
            name: 'mine',
            encoder: { encode: () => null },
            decoder: {
                decode: (input) => {
                    seen.push(input);
                    return null;
                },
            },
            detect: (payload) => typeof payload.q === 'string',
        });
        external.register({
            name: 'fallback',
            encoder: { encode: () => null },
            decoder: { decode: () => null },
        }, true);

        external.decode('q=test');

        expect(seen).toEqual([{ q: 'test' }]);
    });

    it('should decode a pre-parsed query object (req.query)', () => {
        const decoded = codec.decode({
            codec: 'url-expression',
            filter: 'or(eq(name,\'John\'),gte(age,\'18\'))',
        });

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
    });

    describe('parameter masking', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'user',
            filters: { allowed: ['id', 'name'] },
            sort: { default: { id: 'DESC' } },
            pagination: { maxLimit: 10 },
        }));

        const aware = createURLCodec(registry);

        it('should decode only the listed parameters', () => {
            const decoded = aware.decode('filter[name]=John&page[limit]=50&sort=-id', {
                schema: 'user',
                parameters: ['filters'],
            });

            expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'John')]));
            // masked parameters are neither parsed nor defaulted —
            // no maxLimit-capped pagination, no default sort.
            expect(decoded!.pagination.limit).toBeUndefined();
            expect(decoded!.pagination.offset).toBeUndefined();
            expect(decoded!.sorts.value).toHaveLength(0);
        });

        it('should skip masked schema defaults through decodeAsync', async () => {
            const decoded = await aware.decodeAsync('filter[name]=John', {
                schema: 'user',
                parameters: ['filters'],
            });

            expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'John')]));
            expect(decoded!.pagination.limit).toBeUndefined();
            expect(decoded!.sorts.value).toHaveLength(0);
        });

        it('should encode only the listed parameters', () => {
            const query = defineQuery({
                filters: { name: 'John' },
                pagination: { limit: 50 },
            });

            const encoded = codec.encode(query, {
                parameters: ['filters'],
                stamp: false,
            });

            expect(decodeURIComponent(encoded!)).toEqual('filter=eq(name,\'John\')');
        });

        it('should intersect the mask with schema-aware encoding', () => {
            const query = defineQuery({
                filters: { name: 'John' },
                pagination: { limit: 50 },
            });

            const encoded = aware.encode(query, {
                schema: 'user',
                parameters: ['filters'],
                stamp: false,
            });

            expect(decodeURIComponent(encoded!)).toEqual('filter=eq(name,\'John\')');
        });
    });

    it('should fail loudly for an unregistered stamped codec', () => {
        try {
            codec.decode('codec=url-mongo&filter[name]=John');
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(CodecError);
            expect((e as CodecError).code).toBe(ErrorCode.CODEC_UNRESOLVABLE);
        }
    });

    it('should throw when no codec is registered', () => {
        const empty = new URLCodec();

        expect(() => empty.encode(defineQuery({ filters: { a: 1 } }))).toThrowError(CodecError);
    });

    it('should dispatch to an externally registered codec', () => {
        const external = new URLCodec();
        external.register({
            name: 'noop',
            encoder: { encode: () => 'x=1' },
            decoder: { decode: () => null },
        });

        expect(external.encode(defineQuery({ filters: { a: 1 } }))).toEqual('codec=noop&x=1');
        expect(external.decode('codec=noop')).toBeNull();
    });

    it('should preserve sync-only external codecs in async dispatch', async () => {
        const external = new URLCodec();
        external.register({
            name: 'noop',
            encoder: { encode: () => 'x=1' },
            decoder: { decode: () => null },
        });

        await expect(external.encodeAsync(defineQuery({ filters: { a: 1 } })))
            .resolves.toEqual('codec=noop&x=1');
        await expect(external.decodeAsync('codec=noop')).resolves.toBeNull();
    });

    it('should dispatch bundled async codecs for asynchronous validators', async () => {
        const schema = defineSchema({
            filters: {
                validate: async (filter) => eq(
                    filter.field,
                    String(filter.value).toUpperCase(),
                ),
            },
        });
        const query = defineQuery({ filters: eq('name', 'John') });

        const encoded = await codec.encodeAsync(query, { schema });
        const decoded = await codec.decodeAsync(encoded!, { schema });

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-expression&filter=eq(name,\'JOHN\')',
        );
        expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'JOHN')]));
    });

    it('should strip the reserved parameter before delegating', () => {
        const seen : unknown[] = [];

        const external = new URLCodec();
        external.register({
            name: 'noop',
            encoder: { encode: () => null },
            decoder: {
                decode: (input) => {
                    seen.push(input);
                    return null;
                },
            },
        });

        external.decode('codec=noop&filter[name]=John');
        external.decode({ codec: 'noop', filter: { name: 'John' } });

        expect(seen).toEqual([
            { filter: { name: 'John' } },
            { filter: { name: 'John' } },
        ]);
    });

    it('should return null for an empty query', () => {
        expect(codec.encode(defineQuery({}) as IQuery)).toBeNull();
    });
});

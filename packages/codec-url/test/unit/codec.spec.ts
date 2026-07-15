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

    it('should decode a pre-parsed query object (req.query)', () => {
        const decoded = codec.decode({
            codec: 'url-expression',
            filter: 'or(eq(name,\'John\'),gte(age,\'18\'))',
        });

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
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

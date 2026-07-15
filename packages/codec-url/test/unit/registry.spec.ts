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
import { URLCodecRegistry, createURLCodecRegistry } from '../../src';

describe('URLCodecRegistry', () => {
    const registry = createURLCodecRegistry();

    it('should stamp the codec identity when encoding', () => {
        const query = defineQuery({ filters: { name: 'John' } });

        const encoded = registry.encode(query);

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-simple&filter[name]=John',
        );
    });

    it('should encode with an explicitly named codec', () => {
        const query = defineQuery({ filters: or(eq('name', 'John'), gte('age', 18)) });

        const encoded = registry.encode(query, { codec: 'url-expression' });

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-expression&filter=or(eq(name,\'John\'),gte(age,\'18\'))',
        );
    });

    it('should dispatch decoding on the stamped identity', () => {
        const query = defineQuery({ filters: or(eq('name', 'John'), gte('age', 18)) });

        const decoded = registry.decode(registry.encode(query, { codec: 'url-expression' })!);

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
    });

    it('should fall back to the default codec for unstamped payloads', () => {
        const decoded = registry.decode('filter[name]=John');

        expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'John')]));
    });

    it('should decode a pre-parsed query object (req.query)', () => {
        const decoded = registry.decode({
            codec: 'url-expression',
            filter: 'or(eq(name,\'John\'),gte(age,\'18\'))',
        });

        expect(decoded!.filters).toEqual(or(eq('name', 'John'), gte('age', 18)));
    });

    it('should fail loudly for an unregistered stamped codec', () => {
        try {
            registry.decode('codec=url-mongo&filter[name]=John');
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(CodecError);
            expect((e as CodecError).code).toBe(ErrorCode.CODEC_UNRESOLVABLE);
        }
    });

    it('should throw when no codec is registered', () => {
        const empty = new URLCodecRegistry();

        expect(() => empty.encode(defineQuery({ filters: { a: 1 } }))).toThrowError(CodecError);
    });

    it('should dispatch to an externally registered codec', () => {
        const external = new URLCodecRegistry();
        external.register({
            name: 'noop',
            encoder: { encode: () => 'x=1' },
            decoder: { decode: () => null },
        });

        expect(external.encode(defineQuery({ filters: { a: 1 } }))).toEqual('codec=noop&x=1');
        expect(external.decode('codec=noop')).toBeNull();
    });

    it('should preserve sync-only external codecs in async dispatch', async () => {
        const external = new URLCodecRegistry();
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

        const encoded = await registry.encodeAsync(query, {
            codec: 'url-expression',
            schema,
        });
        const decoded = await registry.decodeAsync(encoded!, { schema });

        expect(decodeURIComponent(encoded!)).toEqual(
            'codec=url-expression&filter=eq(name,\'JOHN\')',
        );
        expect(decoded!.filters).toEqual(new Filters('and', [eq('name', 'JOHN')]));
    });

    it('should strip the reserved parameter before delegating', () => {
        const seen : unknown[] = [];

        const external = new URLCodecRegistry();
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
        expect(registry.encode(defineQuery({}) as IQuery)).toBeNull();
    });
});

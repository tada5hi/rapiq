/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from '../../../src';
import { DecoderRelationsParser, RelationsParseError, defineSchema } from '../../../src';
import { registry } from '../../data/schema';

describe('src/relations/index.ts', () => {
    let parser : DecoderRelationsParser;

    beforeAll(() => {
        parser = new DecoderRelationsParser(registry);
    });

    it('should parse simple relations', async () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile'],
            },
            throwOnFailure: true,
        });
        let output = await parser.parse('profile', { schema });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);

        output = await parser.parse([], { schema });
        expect(output).toEqual([]);
    });

    it('should parse with invalid pattern', async () => {
        // invalid path
        const output = await parser.parse(['profile!']);
        expect(output).toEqual([]);
    });

    it('should parse ignore path pattern, if permitted by allowed key', async () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile!'],
            },
        });

        // ignore path pattern, if permitted by an allowed key
        const output = await parser.parse(['profile!'], { schema });
        expect(output).toEqual(['profile!'] satisfies RelationsParseOutput);
    });

    it('should parse with alias', async () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile'],
                mapping: {
                    pro: 'profile',
                },
            },
        });

        // with alias
        const output = await parser.parse('pro', { schema });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with nested alias', async () => {
        // with nested alias
        const output = await parser.parse(['abc.realm'], { schema: 'user' });
        expect(output).toEqual([
            'items',
            'items.realm',
        ] satisfies RelationsParseOutput);
    });

    it('should parse with array input', async () => {
        // multiple data matching
        const output = await parser.parse(['profile', 'abc'], {
            schema: defineSchema({
                relations: {
                    allowed: ['profile'],
                },
            }),
        });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with empty allowed', async () => {
        // no allowed
        const output = await parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: [],
                },
            }),
        });
        expect(output).toEqual([] satisfies RelationsParseOutput);
    });

    it('should parse with undefined allowed', async () => {
        // non array, permit everything
        const output = await parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: undefined,
                },
            }),
        });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with nested allowed', async () => {
        // nested data with alias
        const output = await parser.parse([
            'items.realm',
        ], {
            schema: 'user',
        });
        expect(output).toEqual([
            'items',
            'items.realm',
        ] satisfies RelationsParseOutput);
    });

    it('should pare with null input', async () => {
        // null data
        const output = await parser.parse(null);
        expect(output).toEqual([]);
    });

    it('should throw on invalid input', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.inputInvalid();

        await expect(parser.parse(['foo', true], { schema })).rejects.toThrow(error.message);

        await expect(parser.parse(false, { schema })).rejects.toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
            relations: {
                allowed: ['foo'],
            },
        });

        const error = RelationsParseError.keyInvalid('bar');

        await expect(parser.parse(['foo', 'bar'], { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.keyInvalid(',foo');

        await expect(parser.parse([',foo'], { schema })).rejects.toThrow(error);
    });
});

/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsParseOutput } from '../../../src';
import { RelationsParseError, RelationsParser, defineSchema } from '../../../src';
import { registry } from '../../data/schema';

describe('src/relations/index.ts', () => {
    let parser : RelationsParser;

    beforeAll(() => {
        parser = new RelationsParser(registry);
    });

    it('should parse simple relations', () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile'],
            },
            throwOnFailure: true,
        });
        let output = parser.parse('profile', { schema });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);

        output = parser.parse([], { schema });
        expect(output).toEqual([]);
    });

    it('should parse with invalid pattern', () => {
        // invalid path
        const output = parser.parse(['profile!']);
        expect(output).toEqual([]);
    });

    it('should parse ignore path pattern, if permitted by allowed key', () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile!'],
            },
        });

        // ignore path pattern, if permitted by an allowed key
        const output = parser.parse(['profile!'], { schema });
        expect(output).toEqual(['profile!'] satisfies RelationsParseOutput);
    });

    it('should parse with alias', () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile'],
                mapping: {
                    pro: 'profile',
                },
            },
        });

        // with alias
        const output = parser.parse('pro', { schema });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with nested alias', () => {
        // with nested alias
        const output = parser.parse(['abc.realm'], { schema: 'user' });
        expect(output).toEqual([
            'items',
            'items.realm',
        ] satisfies RelationsParseOutput);
    });

    it('should parse with array input', () => {
        // multiple data matching
        const output = parser.parse(['profile', 'abc'], {
            schema: defineSchema({
                relations: {
                    allowed: ['profile'],
                },
            }),
        });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with empty allowed', () => {
        // no allowed
        const output = parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: [],
                },
            }),
        });
        expect(output).toEqual([] satisfies RelationsParseOutput);
    });

    it('should parse with undefined allowed', () => {
        // non array, permit everything
        const output = parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: undefined,
                },
            }),
        });
        expect(output).toEqual(['profile'] satisfies RelationsParseOutput);
    });

    it('should parse with nested allowed', () => {
        // nested data with alias
        const output = parser.parse([
            'items.realm',
        ], {
            schema: 'user',
        });
        expect(output).toEqual([
            'items',
            'items.realm',
        ] satisfies RelationsParseOutput);
    });

    it('should pare with null input', () => {
        // null data
        const output = parser.parse(null);
        expect(output).toEqual([]);
    });

    it('should throw on invalid input', () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.inputInvalid();

        let evaluate = () => {
            parser.parse(['foo', true], { schema });
        };
        expect(evaluate).toThrow(error);

        evaluate = () => {
            parser.parse(false, { schema });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on non allowed key', () => {
        const schema = defineSchema({
            throwOnFailure: true,
            relations: {
                allowed: ['foo'],
            },
        });

        const error = RelationsParseError.keyInvalid('bar');

        const evaluate = () => {
            parser.parse(['foo', 'bar'], { schema });
        };
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid key', () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.keyInvalid(',foo');

        const evaluate = () => {
            parser.parse([',foo'], { schema });
        };
        expect(evaluate).toThrow(error);
    });
});

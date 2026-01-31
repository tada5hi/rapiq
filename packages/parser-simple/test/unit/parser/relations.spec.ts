/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RelationsParseError, defineSchema } from '@rapiq/core';
import type { IInterpreter, Relations } from '@rapiq/core';
import { registry } from '../../data';
import { SimpleRelationsParser } from '../../../src';

class RelationsSimpleInterpreter implements IInterpreter<Relations, string[]> {
    interpret(input: Relations): string[] {
        return input.value.map((relation) => relation.name);
    }
}

describe('src/relations/index.ts', () => {
    let parser : SimpleRelationsParser;
    let interpreter : RelationsSimpleInterpreter;

    beforeAll(() => {
        parser = new SimpleRelationsParser(registry);
        interpreter = new RelationsSimpleInterpreter();
    });

    it('should parse simple relations', async () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile'],
            },
            throwOnFailure: true,
        });
        let output = parser.parse('profile', { schema });
        expect(interpreter.interpret(output)).toEqual(['profile']);

        output = parser.parse([], { schema });
        expect(interpreter.interpret(output)).toEqual([]);
    });

    it('should parse with invalid pattern', async () => {
        // invalid path
        const output = parser.parse(['profile!']);
        expect(interpreter.interpret(output)).toEqual([]);
    });

    it('should parse ignore path pattern, if permitted by allowed key', async () => {
        const schema = defineSchema({
            relations: {
                allowed: ['profile!'],
            },
        });

        // ignore path pattern, if permitted by an allowed key
        const output = parser.parse(['profile!'], { schema });
        expect(interpreter.interpret(output)).toEqual(['profile!']);
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
        const output = parser.parse('pro', { schema });
        expect(interpreter.interpret(output)).toEqual(['profile']);
    });

    it('should parse with nested alias', async () => {
        // with nested alias
        const output = parser.parse(['abc.realm'], { schema: 'user' });
        expect(interpreter.interpret(output)).toEqual([
            'items',
            'items.realm',
        ]);
    });

    it('should parse with array input', async () => {
        // multiple data matching
        const output = parser.parse(['profile', 'abc'], {
            schema: defineSchema({
                relations: {
                    allowed: ['profile'],
                },
            }),
        });
        expect(interpreter.interpret(output)).toEqual(['profile']);
    });

    it('should parse with empty allowed', async () => {
        // no allowed
        const output = parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: [],
                },
            }),
        });
        expect(interpreter.interpret(output)).toEqual([]);
    });

    it('should parse with undefined allowed', async () => {
        // non array, permit everything
        const output = parser.parse(['profile'], {
            schema: defineSchema({
                relations: {
                    allowed: undefined,
                },
            }),
        });
        expect(interpreter.interpret(output)).toEqual(['profile']);
    });

    it('should parse with nested allowed', async () => {
        // nested data with alias
        const output = parser.parse([
            'items.realm',
        ], {
            schema: 'user',
        });
        expect(interpreter.interpret(output)).toEqual([
            'items',
            'items.realm',
        ]);
    });

    it('should pare with null input', async () => {
        // null data
        const output = parser.parse(null);
        expect(interpreter.interpret(output)).toEqual([]);
    });

    it('should throw on invalid input', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.inputInvalid();

        expect(() => parser.parse(['foo', true], { schema })).toThrow(error.message);
        expect(() => parser.parse(false, { schema })).toThrow(error);
    });

    it('should throw on non allowed key', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
            relations: {
                allowed: ['foo'],
            },
        });

        const error = RelationsParseError.keyInvalid('bar');
        expect(() => parser.parse(['foo', 'bar'], { schema })).toThrow(error);
    });

    it('should throw on invalid key', async () => {
        const schema = defineSchema({
            throwOnFailure: true,
        });

        const error = RelationsParseError.keyInvalid(',foo');
        expect(() => parser.parse([',foo'], { schema })).toThrow(error);
    });
});

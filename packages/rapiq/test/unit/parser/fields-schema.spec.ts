/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { DecoderFieldsParser, type FieldsParseOutput } from '../../../src';
import { registry } from '../../data/schema';
import type { IInterpreter } from '../../../src/interpreter';
import type { Fields } from '../../../src/parameter';

class FieldsSimpleInterpreter implements IInterpreter<Fields, string[]> {
    interpret(input: Fields): string[] {
        return input.value.map((input) => input.name);
    }
}

describe('parser/fields/schema', () => {
    let parser: DecoderFieldsParser;
    let interpreter : FieldsSimpleInterpreter;

    beforeAll(() => {
        parser = new DecoderFieldsParser(registry);
        interpreter = new FieldsSimpleInterpreter();
    });

    it('should parse root schema', async () => {
        const output = await parser.parse('id,name', {
            schema: 'user',
        });

        expect(interpreter.interpret(output)).toEqual(['id', 'name'] satisfies FieldsParseOutput);
    });

    it('should not parse root schema', async () => {
        const output = await parser.parse('id,name,foo', {
            schema: 'user',
        });

        expect(interpreter.interpret(output)).toEqual([
            'id',
            'name',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid sub schema field', async () => {
        const output = await parser.parse(
            'user.name,realm.name',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'realm.name',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with invalid sub schema field', async () => {
        const output = await parser.parse(
            'user.name,realm.foo',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'realm.id',
            'realm.name',
            'realm.description',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid sub sub schema field', async () => {
        const output = await parser.parse(
            'user.name,item.realm.name',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'item.id',
            'item.realm.name',
        ] satisfies FieldsParseOutput);
    });

    it('should parse with invalid sub sub schema field', async () => {
        const output = await parser.parse(
            'user.name,item.realm.foo',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'item.id',
            'item.realm.id',
            'item.realm.name',
            'item.realm.description',
        ] satisfies FieldsParseOutput);
    });
});

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Fields, IInterpreter } from '@rapiq/core';
import { registry } from '../../data/schema';
import { SimpleFieldsParser } from '../../../src';

class FieldsSimpleInterpreter implements IInterpreter<Fields, string[]> {
    interpret(input: Fields): string[] {
        return input.value.map((input) => input.name);
    }
}

describe('parser/fields/schema', () => {
    let parser: SimpleFieldsParser;
    let interpreter : FieldsSimpleInterpreter;

    beforeAll(() => {
        parser = new SimpleFieldsParser(registry);
        interpreter = new FieldsSimpleInterpreter();
    });

    it('should parse root schema', async () => {
        const output = parser.parse('id,name', {
            schema: 'user',
        });

        expect(interpreter.interpret(output)).toEqual(['id', 'name']);
    });

    it('should not parse root schema', async () => {
        const output = parser.parse('id,name,foo', {
            schema: 'user',
        });

        expect(interpreter.interpret(output)).toEqual([
            'id',
            'name',
        ]);
    });

    it('should parse with valid sub schema field', async () => {
        const output = parser.parse(
            'user.name,realm.name',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'realm.name',
        ]);
    });

    it('should parse with invalid sub schema field', async () => {
        const output = parser.parse(
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
        ]);
    });

    it('should parse with valid sub sub schema field', async () => {
        const output = parser.parse(
            'user.name,item.realm.name',
            {
                schema: 'user',
            },
        );

        expect(interpreter.interpret(output)).toEqual([
            'name',
            'item.id',
            'item.realm.name',
        ]);
    });

    it('should parse with invalid sub sub schema field', async () => {
        const output = parser.parse(
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
        ]);
    });
});

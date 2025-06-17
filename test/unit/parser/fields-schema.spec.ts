/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { type FieldsParseOutput, FieldsParser } from '../../../src';
import { registry } from '../../data/schema';

describe('parser/fields/schema', () => {
    let parser: FieldsParser;

    beforeAll(() => {
        parser = new FieldsParser(registry);
    });

    it('should parse root schema', () => {
        const output = parser.parse('id,name', {
            schema: 'user',
        });

        expect(output).toEqual([
            {
                key: 'id',
            },
            {
                key: 'name',
            },
        ] satisfies FieldsParseOutput);
    });

    it('should not parse root schema', () => {
        const output = parser.parse('id,name,foo', {
            schema: 'user',
        });

        expect(output).toEqual([
            {
                key: 'id',
            },
            {
                key: 'name',
            },
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid sub schema field', () => {
        const output = parser.parse(
            'user.name,realm.name',
            {
                schema: 'user',
            },
        );

        expect(output).toEqual([
            {
                key: 'name',
            },
            {
                path: 'realm',
                key: 'name',
            },
        ] satisfies FieldsParseOutput);
    });

    it('should parse with invalid sub schema field', () => {
        const output = parser.parse(
            'user.name,realm.foo',
            {
                schema: 'user',
            },
        );

        expect(output).toEqual([
            {
                key: 'name',
            },
            {
                key: 'id',
                path: 'realm',
            },
            {
                key: 'name',
                path: 'realm',
            },
            {
                key: 'description',
                path: 'realm',
            },
        ] satisfies FieldsParseOutput);
    });

    it('should parse with valid sub sub schema field', () => {
        const output = parser.parse(
            'user.name,item.realm.name',
            {
                schema: 'user',
            },
        );

        expect(output).toEqual([
            {
                key: 'name',
            },
            {
                key: 'id',
                path: 'item',
            },
            {
                path: 'item.realm',
                key: 'name',
            },
        ] satisfies FieldsParseOutput);
    });

    it('should parse with invalid sub sub schema field', () => {
        const output = parser.parse(
            'user.name,item.realm.foo',
            {
                schema: 'user',
            },
        );

        expect(output).toEqual([
            {
                key: 'name',
            },
            {
                key: 'id',
                path: 'item',
            },
            {
                key: 'id',
                path: 'item.realm',
            },
            {
                key: 'name',
                path: 'item.realm',
            },
            {
                key: 'description',
                path: 'item.realm',
            },
        ] satisfies FieldsParseOutput);
    });
});

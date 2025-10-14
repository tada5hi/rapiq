/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { DecoderFieldsParser, type FieldsParseOutput } from '../../../src';
import { registry } from '../../data/schema';

describe('parser/fields/schema', () => {
    let parser: DecoderFieldsParser;

    beforeAll(() => {
        parser = new DecoderFieldsParser(registry);
    });

    it('should parse root schema', async () => {
        const output = await parser.parse('id,name', {
            schema: 'user',
        });

        expect(output).toEqual(['id', 'name'] satisfies FieldsParseOutput);
    });

    it('should not parse root schema', async () => {
        const output = await parser.parse('id,name,foo', {
            schema: 'user',
        });

        expect(output).toEqual([
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

        expect(output).toEqual([
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

        expect(output).toEqual([
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

        expect(output).toEqual([
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

        expect(output).toEqual([
            'name',
            'item.id',
            'item.realm.id',
            'item.realm.name',
            'item.realm.description',
        ] satisfies FieldsParseOutput);
    });
});

/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsParser, defineSchema } from '../../../src';
import { registry } from '../../data/schema';

describe('parser/fields/hooks', () => {
    let parser: FieldsParser;

    beforeAll(() => {
        parser = new FieldsParser(registry);
    });

    it('should work with hook: parse:normalized', async () => {
        const schema = defineSchema({});
        schema.fields.hook('parse:normalized', () => {});

        const output = await parser.parse(['foo'], { schema });
        expect(output).toEqual(['foo']);

        expect(schema.fields.hooks._hooks['parse:normalized']).toBeDefined();
    });

    it('should work with parse:after hook', async () => {
        const schema = defineSchema({});
        schema.fields.hook('parse:after', (data) => {
            data.push('bar');
        });

        const output = await parser.parse(['foo'], { schema });
        expect(output).toEqual(['foo', 'bar']);
    });

    it('should work with parse:relations hook', async () => {
        const schema = registry.getOrFail('user');
        schema.fields.hook('parse:relations', (data) => {
            data.push('realm');
        });

        const output = await parser.parse(['id', 'realm.name'], { schema, relations: [] });
        expect(output).toEqual([
            'id',
            'realm.name',
        ]);
    });
});

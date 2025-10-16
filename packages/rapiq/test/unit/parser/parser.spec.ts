/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    SchemaRegistry,
    SimpleParser,
    defineSchema,
} from '../../../src';
import { Field, Fields } from '../../../src/parameter';

describe('src/parser', () => {
    it('should parse schema by name', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            fields: {
                allowed: ['id'],
            },
        }));

        const parser = new SimpleParser(registry);

        const output = await parser.parse({
            fields: ['id', 'name'],
        }, {
            schema: 'foo',
        });

        expect(output.fields).toEqual(new Fields([
            new Field('id'),
        ]));
    });
});

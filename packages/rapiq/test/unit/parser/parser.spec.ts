/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Query } from '../../../src';
import {
    DecoderParser,
    SchemaRegistry,
    defineSchema,
} from '../../../src';

describe('src/parser', () => {
    it('should parse schema by name', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            fields: {
                allowed: ['id'],
            },
        }));

        const parser = new DecoderParser(registry);

        const output = await parser.parse({
            fields: ['id', 'name'],
        }, {
            schema: 'foo',
        });

        expect(output).toEqual({
            fields: ['id'],
        } as Query);
    });
});

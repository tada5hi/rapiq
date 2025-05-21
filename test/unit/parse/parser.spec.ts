/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { QueryParseOutput } from '../../../src';
import {
    QueryParser,
    SchemaRegistry,
    defineSchema,
} from '../../../src';

type ParseOutput = QueryParseOutput;

describe('src/parser', () => {
    it('should parse schema by name', () => {
        const registry = new SchemaRegistry();
        registry.add('foo', defineSchema({
            fields: {
                allowed: ['id'],
            },
        }));

        const parser = new QueryParser(registry);

        const output = parser.parse({
            fields: ['id', 'name'],
        }, {
            schema: 'foo',
        });

        expect(output).toEqual({
            fields: [
                { key: 'id' },
            ],
        } as ParseOutput);
    });
});

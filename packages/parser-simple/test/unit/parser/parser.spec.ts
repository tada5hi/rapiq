/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Relation,
    Relations,
    SchemaRegistry, defineSchema,
} from '@rapiq/core';
import { SimpleParser } from '../../../src';

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

        const output = parser.parse({
            fields: ['id', 'name'],
        }, {
            schema: 'foo',
        });

        expect(output.fields).toEqual(new Fields([
            new Field('id'),
        ]));
    });

    it('should keep relations when other parameters are parsed', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'realm',
            fields: {
                allowed: ['id', 'name'],
            },
        }));
        registry.add(defineSchema({
            name: 'user',
            schemaMapping: { realm: 'realm' },
            fields: {
                allowed: ['id', 'name', 'age'],
            },
            relations: {
                allowed: ['realm'],
            },
            sort: {
                allowed: ['id', 'age'],
            },
        }));

        const parser = new SimpleParser(registry);

        const output = parser.parse({
            fields: ['id', 'name'],
            relations: ['realm'],
            sort: '-age',
        }, {
            schema: 'user',
        });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
    });
});

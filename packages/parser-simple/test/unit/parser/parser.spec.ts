/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    FiltersParseError,
    Relation,
    Relations,
    SchemaRegistry,
    Sort,
    SortDirection,
    Sorts,
    defineSchema,
} from '@rapiq/core';
import { SimpleParser } from '../../../src';

describe('src/parser', () => {
    it('should parse schema by name', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            fields: { allowed: ['id'] },
        }));

        const parser = new SimpleParser(registry);

        const output = parser.parse({ fields: ['id', 'name'] }, { schema: 'foo' });

        expect(output.fields).toEqual(new Fields([
            new Field('id'),
        ]));
    });

    it('should keep dotted keys when parsing without a schema', async () => {
        const parser = new SimpleParser();

        const output = parser.parse({ fields: ['id', 'realm.name'] });

        expect(output.fields).toEqual(new Fields([
            new Field('id'),
            new Field('realm.name'),
        ]));
    });

    it('should apply the pagination schema in full-query parsing', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            pagination: { maxLimit: 50 },
        }));

        const parser = new SimpleParser(registry);

        const output = parser.parse({ pagination: { limit: 100 } }, { schema: 'foo' });

        expect(output.pagination.limit).toEqual(50);
        expect(output.pagination.offset).toEqual(0);
    });

    describe('schema defaults', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            fields: { allowed: ['id', 'name'] },
            filters: {
                allowed: ['id'],
                default: new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                throwOnFailure: true,
            },
            sort: { default: { id: 'DESC' } },
            pagination: { maxLimit: 25 },
        }));

        it('should apply defaults when parameters are absent', async () => {
            const parser = new SimpleParser(registry);

            const output = parser.parse({}, { schema: 'foo' });

            expect(output.fields).toEqual(new Fields([
                new Field('id'),
                new Field('name'),
            ]));
            expect(output.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
            ]));
            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
            expect(output.pagination.limit).toEqual(25);
            expect(output.pagination.offset).toEqual(0);
        });

        it('should apply defaults for non-object input', async () => {
            const parser = new SimpleParser(registry);

            const output = parser.parse(undefined, { schema: 'foo' });

            expect(output.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
            ]));
            expect(output.pagination.limit).toEqual(25);
        });

        it('should not treat an absent parameter as a failure', async () => {
            const parser = new SimpleParser(registry);

            // filters schema has throwOnFailure — absent input applies
            // defaults, present but invalid input still throws.
            expect(() => parser.parse({}, { schema: 'foo' })).not.toThrow();
            expect(() => parser.parse({ filters: 1 }, { schema: 'foo' })).toThrow();
        });
    });

    it('should enforce the relations allow-list in full-query parsing', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'user',
            relations: { allowed: ['realm'] },
        }));

        const parser = new SimpleParser(registry);

        const output = parser.parse({ relations: ['realm', 'owner'] }, { schema: 'user' });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
    });

    describe('strict mode', () => {
        it('should drop undeclared parameter input under a strict schema', async () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'foo',
                strict: true,
                pagination: { maxLimit: 50 },
            }));

            const parser = new SimpleParser(registry);

            const output = parser.parse({
                fields: ['id'],
                filters: { name: 'admin' },
                relations: ['realm'],
                sort: '-id',
                pagination: { limit: 100 },
            }, { schema: 'foo' });

            expect(output.fields).toEqual(new Fields());
            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, []));
            expect(output.relations).toEqual(new Relations());
            expect(output.sorts).toEqual(new Sorts());
            expect(output.pagination.limit).toEqual(50);
        });

        it('should keep declared allow-lists working under a strict schema', async () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'foo',
                strict: true,
                fields: { allowed: ['id', 'name'] },
                filters: { allowed: ['id'] },
            }));

            const parser = new SimpleParser(registry);

            const output = parser.parse({
                fields: ['id', 'email'],
                filters: { id: 1, name: 'admin' },
            }, { schema: 'foo' });

            expect(output.fields).toEqual(new Fields([
                new Field('id'),
            ]));
            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
        });

        it('should apply schema defaults when strict drops client input', async () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'foo',
                strict: true,
                filters: { default: new Filter(FilterFieldOperator.EQUAL, 'id', 1) },
                sort: { default: { id: 'DESC' } },
            }));

            const parser = new SimpleParser(registry);

            const output = parser.parse({
                filters: { name: 'admin' },
                sort: '-name',
            }, { schema: 'foo' });

            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]));
            expect(output.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
            ]));
        });

        it('should reject everything when parsing schemaless with the strict option', async () => {
            const parser = new SimpleParser();

            const output = parser.parse({
                fields: ['id'],
                filters: { name: 'admin' },
                relations: ['realm'],
                sort: '-id',
            }, { strict: true });

            expect(output.fields).toEqual(new Fields());
            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, []));
            expect(output.relations).toEqual(new Relations());
            expect(output.sorts).toEqual(new Sorts());
        });

        it('should let the parse option override a strict schema', async () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'foo',
                strict: true,
            }));

            const parser = new SimpleParser(registry);

            const output = parser.parse({ fields: ['id'] }, {
                schema: 'foo',
                strict: false,
            });

            expect(output.fields).toEqual(new Fields([
                new Field('id'),
            ]));
        });

        it('should throw under strict when the schema sets throwOnFailure', async () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'foo',
                strict: true,
                throwOnFailure: true,
            }));

            const parser = new SimpleParser(registry);

            expect(() => parser.parse({ filters: { name: 'admin' } }, { schema: 'foo' })).toThrow(FiltersParseError);
        });
    });

    it('should keep relations when other parameters are parsed', async () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'realm',
            fields: { allowed: ['id', 'name'] },
        }));
        registry.add(defineSchema({
            name: 'user',
            schemaMapping: { realm: 'realm' },
            fields: { allowed: ['id', 'name', 'age'] },
            relations: { allowed: ['realm'] },
            sort: { allowed: ['id', 'age'] },
        }));

        const parser = new SimpleParser(registry);

        const output = parser.parse({
            fields: ['id', 'name'],
            relations: ['realm'],
            sort: '-age',
        }, { schema: 'user' });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
    });
});

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

    it('should await asynchronous filter validation in full-query parsing', async () => {
        const parser = new SimpleParser();
        const schema = defineSchema({
            filters: {
                validate: async (filter) => new Filter(
                    filter.operator,
                    filter.field,
                    String(filter.value).toUpperCase(),
                ),
            },
        });

        const output = await parser.parseAsync({ filters: { name: 'admin' } }, { schema });

        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
        ]));
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

    describe('parameter masking', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'foo',
            fields: { allowed: ['id', 'name'] },
            filters: { allowed: ['id', 'name'] },
            relations: { allowed: ['realm'] },
            sort: { default: { id: 'DESC' } },
            pagination: { maxLimit: 25 },
        }));

        const input = {
            fields: ['id'],
            filters: { name: 'admin' },
            relations: ['realm'],
            sort: '-id',
            pagination: { limit: 100 },
        };

        it('should parse only the listed parameters', async () => {
            const parser = new SimpleParser(registry);

            const output = parser.parse(input, {
                schema: 'foo',
                parameters: ['filters'],
            });

            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            ]));
            expect(output.fields).toEqual(new Fields());
            expect(output.relations).toEqual(new Relations());
            expect(output.sorts).toEqual(new Sorts());
            expect(output.pagination.limit).toBeUndefined();
            expect(output.pagination.offset).toBeUndefined();
        });

        it('should not materialize schema defaults for masked parameters', async () => {
            const parser = new SimpleParser(registry);

            // without a mask, maxLimit and the sort default apply.
            let output = parser.parse({}, { schema: 'foo' });
            expect(output.pagination.limit).toEqual(25);
            expect(output.sorts).toEqual(new Sorts([
                new Sort('id', SortDirection.DESC),
            ]));

            // with the mask, masked parameters stay empty.
            output = parser.parse({}, { schema: 'foo', parameters: ['filters'] });
            expect(output.pagination.limit).toBeUndefined();
            expect(output.sorts).toEqual(new Sorts());
        });

        it('should intersect with the per-parameter skip options', async () => {
            const parser = new SimpleParser(registry);

            const output = parser.parse(input, {
                schema: 'foo',
                parameters: ['filters', 'pagination'],
                pagination: false,
            });

            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            ]));
            expect(output.pagination.limit).toBeUndefined();
        });

        it('should honor the mask through parseAsync', async () => {
            const parser = new SimpleParser(registry);

            const output = await parser.parseAsync(input, {
                schema: 'foo',
                parameters: ['filters'],
            });

            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            ]));
            expect(output.pagination.limit).toBeUndefined();
            expect(output.relations).toEqual(new Relations());
        });

        it('should resolve relation paths as if no relations were requested', async () => {
            // masked-out relations do not gate relation paths in the
            // other parameters — exactly as when the client requests
            // no relations at all.
            const relationRegistry = new SchemaRegistry();
            relationRegistry.add(defineSchema({
                name: 'realm',
                filters: { allowed: ['id'] },
            }));
            relationRegistry.add(defineSchema({
                name: 'user',
                filters: { allowed: ['id'] },
                relations: { allowed: ['realm'] },
                schemaMapping: { realm: 'realm' },
            }));

            const parser = new SimpleParser(relationRegistry);

            const output = parser.parse({
                filters: { 'realm.id': 1 },
                relations: ['realm'],
            }, {
                schema: 'user',
                parameters: ['filters'],
            });

            expect(output.relations).toEqual(new Relations());
            expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'realm.id', 1),
            ]));
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

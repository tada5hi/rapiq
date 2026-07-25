/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Parameter,
    Relation,
    Relations,
    SchemaRegistry,
    defineSchema,
    eq,
} from '@rapiq/core';
import type { ICondition, IFields, IFilters } from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleParser,
    SimpleSortParser,
} from '../../../src';

const secretCondition = eq('id', 1);

function fieldNames(input: IFields) : string[] {
    return input.value.map((field) => field.name);
}

function conditionOf(input: IFields, name: string) : ICondition | undefined {
    return input.value.find((field) => field.name === name)?.condition;
}

function filterFields(input: IFilters) : string[] {
    const output : string[] = [];
    const walk = (node: any) => {
        for (const child of node.value) {
            if (Array.isArray(child.value)) {
                walk(child);
            } else {
                output.push(child.field as string);
            }
        }
    };
    walk(input);

    return output;
}

describe('src/parameter/fields/module.ts', () => {
    let parser : SimpleFieldsParser;

    beforeAll(() => {
        parser = new SimpleFieldsParser();
    });

    describe('condition verdict at the query root', () => {
        it('should keep the gated field and carry the condition', () => {
            const schema = defineSchema({
                fields: {
                    allowed: ['id', 'name', 'secret'],
                    validate: (name: string) => (name === 'secret' ? secretCondition : true),
                },
            });

            const output = parser.parse(['id', 'secret'], { schema });

            expect(fieldNames(output)).toEqual(['id', 'secret']);
            expect(conditionOf(output, 'secret')).toBe(secretCondition);
            expect(conditionOf(output, 'id')).toBeUndefined();
        });

        it('should hand the root scope to the hook', () => {
            const validate = vi.fn(() => true);
            const schema = defineSchema({
                name: 'user',
                fields: { allowed: ['id'], validate },
            });

            parser.parse(['id'], { schema, context: 'actor' });

            expect(validate).toHaveBeenCalledWith('id', 'actor', {
                parameter: Parameter.FIELDS,
                path: '',
                schema: 'user',
            });
        });

        it('should carry the condition through parseAsync', async () => {
            const schema = defineSchema({
                fields: {
                    allowed: ['id', 'secret'],
                    validate: async (name: string) => (name === 'secret' ? secretCondition : true),
                },
            });

            const output = await parser.parseAsync(['id', 'secret'], { schema });

            expect(fieldNames(output)).toEqual(['id', 'secret']);
            expect(conditionOf(output, 'secret')).toBe(secretCondition);
        });

        it('should still drop a field rejected outright', () => {
            const schema = defineSchema({
                fields: {
                    allowed: ['id', 'secret'],
                    validate: (name: string) => (name !== 'secret'),
                },
            });

            const output = parser.parse(['id', 'secret'], { schema });

            expect(fieldNames(output)).toEqual(['id']);
        });
    });

    describe('condition verdict under a relation path', () => {
        let registry : SchemaRegistry;

        beforeAll(() => {
            registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'user',
                fields: { allowed: ['id', 'name'] },
                relations: { allowed: ['items', 'realm'] },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({
                name: 'item',
                fields: {
                    allowed: ['id', 'secret'],
                    validate: (name: string) => (name === 'secret' ? secretCondition : true),
                },
            }));
            registry.add(defineSchema({
                name: 'realm',
                fields: { allowed: ['id', 'name'] },
            }));
        });

        it('should carry the condition on the prefixed field', () => {
            const scoped = new SimpleFieldsParser(registry);
            const output = scoped.parse({
                user: ['id'],
                items: ['id', 'secret'],
            }, {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });

            expect(fieldNames(output)).toEqual(['id', 'items.id', 'items.secret']);
            expect(conditionOf(output, 'items.secret')).toBe(secretCondition);
            expect(conditionOf(output, 'items.id')).toBeUndefined();
        });

        it('should hand the relation path and target schema to the hook', () => {
            const validate = vi.fn(() => true);
            const scopedRegistry = new SchemaRegistry();
            scopedRegistry.add(defineSchema({
                name: 'user',
                fields: { allowed: ['id'] },
                relations: { allowed: ['items'] },
                schemaMapping: { items: 'item' },
            }));
            scopedRegistry.add(defineSchema({
                name: 'item',
                fields: { allowed: ['id'], validate },
            }));

            const scoped = new SimpleFieldsParser(scopedRegistry);
            scoped.parse({ items: ['id'] }, {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });

            expect(validate).toHaveBeenCalledWith('id', undefined, {
                parameter: Parameter.FIELDS,
                path: 'items',
                schema: 'item',
            });
        });

        it('should carry the condition of a dotted root key', () => {
            const scoped = new SimpleFieldsParser(registry);
            const output = scoped.parse('id,items.secret', {
                schema: 'user',
                relations: new Relations([new Relation('items')]),
            });

            expect(fieldNames(output)).toContain('items.secret');
            expect(conditionOf(output, 'items.secret')).toBe(secretCondition);
        });

        it('should keep conditions of surviving fields through relation pruning', () => {
            const gatedRegistry = new SchemaRegistry();
            gatedRegistry.add(defineSchema({
                name: 'user',
                fields: { allowed: ['id'] },
                relations: {
                    allowed: ['items', 'realm'],
                    validate: (name: string) => name !== 'realm',
                },
                schemaMapping: { items: 'item' },
            }));
            gatedRegistry.add(defineSchema({
                name: 'item',
                fields: {
                    allowed: ['id', 'secret'],
                    validate: (name: string) => (name === 'secret' ? secretCondition : true),
                },
            }));
            gatedRegistry.add(defineSchema({
                name: 'realm',
                fields: { allowed: ['id', 'name'] },
            }));

            const scoped = new SimpleFieldsParser(gatedRegistry);
            const output = scoped.parse({
                items: ['secret'],
                realm: ['name'],
            }, { schema: 'user' });

            expect(fieldNames(output)).toEqual(['id', 'items.secret']);
            expect(conditionOf(output, 'items.secret')).toBe(secretCondition);
        });
    });

    describe('batched validation', () => {
        it('should fire once with every requested field', () => {
            const validateMany = vi.fn((names: string[]) => Object.fromEntries(
                names.map((name) => [name, name === 'secret' ? secretCondition : true]),
            ));
            const schema = defineSchema({
                name: 'user',
                fields: {
                    allowed: ['id', 'name', 'secret'],
                    validateMany,
                },
            });

            const output = parser.parse(['id', 'secret', 'id'], { schema });

            expect(validateMany).toHaveBeenCalledTimes(1);
            expect(validateMany).toHaveBeenCalledWith(['id', 'secret'], undefined, {
                parameter: Parameter.FIELDS,
                path: '',
                schema: 'user',
            });
            expect(fieldNames(output)).toEqual(['id', 'secret']);
            expect(conditionOf(output, 'secret')).toBe(secretCondition);
        });

        it('should not ask about excluded fields or defaults', () => {
            const validateMany = vi.fn((names: string[]) => Object.fromEntries(
                names.map((name) => [name, true]),
            ));
            const schema = defineSchema({
                fields: {
                    allowed: ['id', 'name', 'secret'],
                    validateMany,
                },
            });

            const output = parser.parse(['-secret'], { schema });

            expect(fieldNames(output)).toEqual(['id', 'name']);
            expect(validateMany).not.toHaveBeenCalled();
        });
    });

    describe('sort', () => {
        it('should drop a sort key answered with a condition', () => {
            const sortParser = new SimpleSortParser();
            const schema = defineSchema({
                sort: {
                    allowed: ['id', 'name'],
                    validate: (name: string) => (name === 'name' ? secretCondition : true),
                },
            });

            const output = sortParser.parse(['id', 'name'], { schema });

            expect(output.value.map((sort) => sort.name)).toEqual(['id']);
        });
    });

    describe('query parser', () => {
        it('should gate the field without narrowing the row set', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'user',
                fields: {
                    allowed: ['id', 'name', 'secret'],
                    validate: (name: string) => (name === 'secret' ? secretCondition : true),
                },
                filters: { allowed: ['name'] },
            }));

            const queryParser = new SimpleParser(registry);
            const query = queryParser.parse({
                fields: ['id', 'secret'],
                filters: { name: 'admin' },
            }, { schema: 'user' });

            expect(fieldNames(query.fields)).toEqual(['id', 'secret']);
            expect(conditionOf(query.fields, 'secret')).toBe(secretCondition);
            expect(filterFields(query.filters)).toEqual(['name']);
        });

        it('should not inject a condition into an otherwise empty filters node', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'user',
                fields: {
                    allowed: ['id', 'secret'],
                    validate: () => secretCondition,
                },
            }));

            const queryParser = new SimpleParser(registry);
            const query = queryParser.parse({ fields: ['secret'] }, { schema: 'user' });

            expect(conditionOf(query.fields, 'secret')).toBe(secretCondition);
            expect(filterFields(query.filters)).toEqual([]);
        });

        it('should keep the condition when the pooled relation gate prunes fields', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'user',
                fields: { allowed: ['id'] },
                relations: {
                    allowed: ['items', 'realm'],
                    validate: (name: string) => name !== 'realm',
                },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({
                name: 'item',
                fields: {
                    allowed: ['id', 'secret'],
                    validate: (name: string) => (name === 'secret' ? secretCondition : true),
                },
            }));
            registry.add(defineSchema({
                name: 'realm',
                fields: { allowed: ['id', 'name'] },
            }));

            const queryParser = new SimpleParser(registry);
            const query = queryParser.parse({
                fields: { items: ['secret'], realm: ['name'] },
                relations: ['items', 'realm'],
            }, { schema: 'user' });

            expect(query.relations.value.map((relation) => relation.name)).toEqual(['items']);
            expect(fieldNames(query.fields)).toEqual(['id', 'items.secret']);
            expect(conditionOf(query.fields, 'items.secret')).toBe(secretCondition);
        });
    });
});

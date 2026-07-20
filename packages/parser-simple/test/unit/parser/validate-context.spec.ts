/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FieldsParseError,
    RelationsParseError,
    SchemaRegistry,
    defineSchema,
} from '@rapiq/core';
import type { 
    IFilter, 
    ISorts, 
    Relations, 
    SchemaError, 
} from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimpleParser,
    SimpleRelationsParser,
    SimpleSortParser,
} from '../../../src';

type Actor = {
    permissions: string[],
};

const actor : Actor = { permissions: ['realm_read'] };

function relationNames(input: Relations) : string[] {
    return input.value.map((relation) => relation.name);
}

function sortNames(input: ISorts) : string[] {
    return input.value.map((sort) => sort.name);
}

describe('schema validate hooks with parse context', () => {
    describe('relations', () => {
        let parser : SimpleRelationsParser;

        beforeAll(() => {
            parser = new SimpleRelationsParser();
        });

        it('should drop relations rejected by the validate hook', () => {
            const schema = defineSchema<Record<string, any>, Actor>({
                relations: {
                    allowed: ['realm', 'items'],
                    validate: (name, context) => context.permissions.includes(`${name}_read`),
                },
            });

            const output = parser.parse(['realm', 'items'], { schema, context: actor });
            expect(relationNames(output)).toEqual(['realm']);
        });

        it('should keep relations accepted by the validate hook', () => {
            const validate = vi.fn(() => true);
            const schema = defineSchema({ relations: { allowed: ['realm', 'items'], validate } });

            const output = parser.parse(['realm', 'items'], { schema, context: actor });
            expect(relationNames(output)).toEqual(['realm', 'items']);
            expect(validate).toHaveBeenCalledTimes(2);
            expect(validate).toHaveBeenCalledWith('realm', actor);
            expect(validate).toHaveBeenCalledWith('items', actor);
        });

        it('should invoke the hook with an undefined context by default', () => {
            const validate = vi.fn(() => true);
            const schema = defineSchema({ relations: { allowed: ['realm'], validate } });

            parser.parse(['realm'], { schema });
            expect(validate).toHaveBeenCalledWith('realm', undefined);
        });

        it('should validate deep paths against the target schema', () => {
            const registry = new SchemaRegistry();
            const rootValidate = vi.fn((name: string) => name !== 'realm');
            const itemValidate = vi.fn(() => true);

            registry.add(defineSchema({
                name: 'user',
                relations: { allowed: ['realm', 'items'], validate: rootValidate },
                schemaMapping: { items: 'item' },
            }));
            registry.add(defineSchema({
                name: 'item',
                relations: { allowed: ['realm'], validate: itemValidate },
            }));

            const scopedParser = new SimpleRelationsParser(registry);
            const output = scopedParser.parse(['realm', 'items.realm'], {
                schema: 'user',
                context: actor,
            });

            expect(relationNames(output)).toEqual(['items', 'items.realm']);
            expect(rootValidate).toHaveBeenCalledWith('realm', actor);
            expect(rootValidate).toHaveBeenCalledWith('items', actor);
            expect(itemValidate).toHaveBeenCalledWith('realm', actor);
        });

        it('should drop descendants of a rejected relation', () => {
            const registry = new SchemaRegistry();
            registry.add(defineSchema({
                name: 'user',
                relations: {
                    allowed: ['items'],
                    validate: (name: string) => name !== 'items',
                },
            }));
            registry.add(defineSchema({
                name: 'item',
                relations: { allowed: ['realm'] },
            }));

            const scopedParser = new SimpleRelationsParser(registry);
            const output = scopedParser.parse(['items.realm'], { schema: 'user' });

            expect(relationNames(output)).toEqual([]);
        });

        it('should throw on rejection under throwOnFailure', () => {
            const schema = defineSchema({
                throwOnFailure: true,
                relations: {
                    allowed: ['realm'],
                    validate: () => false,
                },
            });

            expect.assertions(2);
            try {
                parser.parse(['realm'], { schema });
            } catch (e) {
                expect(e).toBeInstanceOf(RelationsParseError);
                expect((e as RelationsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
            }
        });

        it('should refuse an async hook on the sync parse path', () => {
            const schema = defineSchema({
                relations: {
                    allowed: ['realm'],
                    validate: async () => true,
                },
            });

            expect.assertions(1);
            try {
                parser.parse(['realm'], { schema });
            } catch (e) {
                expect((e as SchemaError).code)
                    .toEqual(ErrorCode.SCHEMA_VALIDATOR_ASYNC_REQUIRES_ASYNC_PARSER);
            }
        });

        it('should await async hooks on parseAsync', async () => {
            const schema = defineSchema<Record<string, any>, Actor>({
                relations: {
                    allowed: ['realm', 'items'],
                    validate: async (name, context) => context.permissions.includes(`${name}_read`),
                },
            });

            const output = await parser.parseAsync(['realm', 'items'], {
                schema,
                context: actor,
            });
            expect(relationNames(output as Relations)).toEqual(['realm']);
        });
    });

    describe('fields', () => {
        let parser : SimpleFieldsParser;

        beforeAll(() => {
            parser = new SimpleFieldsParser();
        });

        it('should drop fields rejected by the validate hook', () => {
            const schema = defineSchema<Record<string, any>, Actor>({
                fields: {
                    allowed: ['id', 'name', 'email'],
                    validate: (name) => name !== 'email',
                },
            });

            const output = parser.parse(['id', 'email'], { schema, context: actor });
            expect(output.value.map((field) => field.name)).toEqual(['id']);
        });

        it('should not invoke the hook for schema defaults', () => {
            const validate = vi.fn(() => false);
            const schema = defineSchema({
                fields: {
                    allowed: ['id', 'name'],
                    default: ['id'],
                    validate,
                },
            });

            const output = parser.parse(undefined, { schema, context: actor });
            expect(output.value.map((field) => field.name)).toEqual(['id']);
            expect(validate).not.toHaveBeenCalled();
        });

        it('should throw on rejection under throwOnFailure', () => {
            const schema = defineSchema({
                throwOnFailure: true,
                fields: {
                    allowed: ['id'],
                    validate: () => undefined,
                },
            });

            expect.assertions(2);
            try {
                parser.parse(['id'], { schema });
            } catch (e) {
                expect(e).toBeInstanceOf(FieldsParseError);
                expect((e as FieldsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
            }
        });
    });

    describe('sort', () => {
        let parser : SimpleSortParser;

        beforeAll(() => {
            parser = new SimpleSortParser();
        });

        it('should drop sort keys rejected by the validate hook', () => {
            const schema = defineSchema<Record<string, any>, Actor>({
                sort: {
                    allowed: ['id', 'age'],
                    validate: (name) => name !== 'age',
                },
            });

            const output = parser.parse(['-age', 'id'], { schema, context: actor });
            expect(sortNames(output)).toEqual(['id']);
        });

        it('should not invoke the hook for schema defaults', () => {
            const validate = vi.fn(() => false);
            const schema = defineSchema({
                sort: {
                    default: { id: 'DESC' },
                    validate,
                },
            });

            const output = parser.parse(undefined, { schema, context: actor });
            expect(sortNames(output)).toEqual(['id']);
            expect(validate).not.toHaveBeenCalled();
        });
    });

    describe('filters', () => {
        let parser : SimpleFiltersParser;

        beforeAll(() => {
            parser = new SimpleFiltersParser();
        });

        it('should forward the context to the filters validator', () => {
            const validate = vi.fn((input: IFilter) => input);
            const schema = defineSchema({ filters: { allowed: ['name'], validate } });

            parser.parse({ name: 'admin' }, { schema, context: actor });

            expect(validate).toHaveBeenCalledTimes(1);
            expect(validate.mock.calls[0]?.[1]).toEqual(actor);
        });
    });

    describe('query parser', () => {
        it('should thread the context from parse options into the hooks', () => {
            const validate = vi.fn(
                (name: string, context: Actor) => context.permissions.includes(`${name}_read`),
            );

            const registry = new SchemaRegistry();
            registry.add(defineSchema<Record<string, any>, Actor>({
                name: 'user',
                relations: { allowed: ['realm', 'items'], validate },
            }));

            const parser = new SimpleParser(registry);
            const output = parser.parse(
                { relations: ['realm', 'items'] },
                { schema: 'user', context: actor },
            );

            expect(relationNames(output.relations as Relations)).toEqual(['realm']);
            expect(validate).toHaveBeenCalledWith('realm', actor);
            expect(validate).toHaveBeenCalledWith('items', actor);
        });
    });
});

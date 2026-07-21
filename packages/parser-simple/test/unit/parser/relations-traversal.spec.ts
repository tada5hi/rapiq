/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    RelationsParseError,
    SchemaRegistry,
    defineSchema,
} from '@rapiq/core';
import type { IFilters, IQuery } from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimpleParser,
    SimpleSortParser,
} from '../../../src';

type Actor = { permissions: string[] };

const actor : Actor = { permissions: ['realm_read'] };

/**
 * user → { realm, items(item) }, item → { realm }. The relations validate hook
 * of the user schema is supplied per test; item/realm relations are open.
 */
function buildRegistry(
    validate: (name: string, context: Actor) => boolean | undefined | Promise<boolean | undefined>,
    throwOnFailure = false,
) : SchemaRegistry {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Record<string, any>, Actor>({
        name: 'user',
        throwOnFailure,
        fields: { allowed: ['id', 'name', 'email'] },
        filters: { allowed: ['id', 'name', 'email'] },
        sort: { allowed: ['id', 'name'], default: { name: 'DESC' } },
        relations: { allowed: ['realm', 'items'], validate },
        schemaMapping: { items: 'item', realm: 'realm' },
    }));
    registry.add(defineSchema({
        name: 'item',
        fields: { allowed: ['id'] },
        filters: { allowed: ['id'] },
        sort: { allowed: ['id'] },
        relations: { allowed: ['realm'] },
        schemaMapping: { realm: 'realm' },
    }));
    registry.add(defineSchema({
        name: 'realm',
        fields: { allowed: ['id', 'name'] },
        filters: { allowed: ['id', 'name'] },
        sort: { allowed: ['id', 'name'] },
    }));

    return registry;
}

function filterFields(input: IFilters | undefined) : string[] {
    const output : string[] = [];
    const walk = (node: any) => {
        for (const child of node.value) {
            if (Array.isArray(child.value)) {
                walk(child);
            } else if (typeof child.field === 'string') {
                output.push(child.field);
            }
        }
    };
    if (input) {
        walk(input);
    }

    return output;
}

function fieldNames(query: IQuery) : string[] {
    return query.fields.value.map((field) => field.name);
}

function sortNames(query: IQuery) : string[] {
    return query.sorts.value.map((sort) => sort.name);
}

function relationNames(query: IQuery) : string[] {
    return query.relations.value.map((relation) => relation.name);
}

describe('relations.validate for traversed relation paths (#815)', () => {
    describe('query parser — include-less bypass is closed', () => {
        it('runs the hook for a relation referenced only by filters and prunes on rejection', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { filters: { 'items.id': '1' } },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(filterFields(query.filters)).toEqual([]);
        });

        it('runs the hook for a relation referenced only by fields and prunes on rejection', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { fields: { items: ['id'] } },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(fieldNames(query)).not.toContain('items.id');
        });

        it('runs the hook for a relation referenced only by sort and prunes on rejection', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { sort: ['items.id'] },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(sortNames(query)).not.toContain('items.id');
        });

        it('runs the hook for a relation an EXCLUDED field would auto-join', () => {
            // excluding items.id selects no column, but the SQL adapters still
            // join the relation for the dotted path — it must clear the gate too.
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { fields: { items: ['-id'] } },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(fieldNames(query)).not.toContain('items.id');
        });

        it('keeps the dependent keys when the hook accepts the relation', () => {
            const validate = vi.fn(() => true);
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                {
                    filters: { 'items.id': '1' }, 
                    fields: { items: ['id'] }, 
                    sort: ['items.id'], 
                },
                { schema: 'user', context: actor },
            );

            expect(filterFields(query.filters)).toContain('items.id');
            expect(fieldNames(query)).toContain('items.id');
            expect(sortNames(query)).toContain('items.id');
        });
    });

    describe('query parser — single authorization point (dedup)', () => {
        it('invokes the hook once for a relation referenced by several parameters', () => {
            const validate = vi.fn(() => true);
            const parser = new SimpleParser(buildRegistry(validate));

            parser.parse(
                {
                    relations: ['items'],
                    filters: { 'items.id': '1' },
                    fields: { items: ['id'] },
                    sort: ['items.id'],
                },
                { schema: 'user', context: actor },
            );

            const itemsCalls = validate.mock.calls.filter(([name]) => name === 'items');
            expect(itemsCalls).toHaveLength(1);
        });

        it('validates every hop of a deep path and cascades a rejected intermediate', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { filters: { 'items.realm.id': '1' }, sort: ['items.realm.name'] },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(filterFields(query.filters)).toEqual([]);
            expect(sortNames(query)).not.toContain('items.realm.name');
        });
    });

    describe('query parser — cascade & defaults', () => {
        it('drops the auto-joined relation and its dependents together', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                {
                    relations: ['realm', 'items'], 
                    filters: { 'items.id': '1' }, 
                    fields: { items: ['id'] }, 
                },
                { schema: 'user', context: actor },
            );

            expect(relationNames(query)).toEqual(['realm']);
            expect(fieldNames(query)).not.toContain('items.id');
            expect(filterFields(query.filters)).toEqual([]);
        });

        it('re-applies the sort default when relation pruning empties the sort', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { sort: ['items.id'] },
                { schema: 'user', context: actor },
            );

            expect(sortNames(query)).toEqual(['name']);
        });
    });

    describe('query parser — throwOnFailure', () => {
        it('throws RelationsParseError when a traversed relation is rejected', () => {
            const parser = new SimpleParser(buildRegistry(() => false, true));

            expect.assertions(2);
            try {
                parser.parse({ filters: { 'items.id': '1' } }, { schema: 'user', context: actor });
            } catch (e) {
                expect(e).toBeInstanceOf(RelationsParseError);
                expect((e as RelationsParseError).code).toEqual(ErrorCode.KEY_VALIDATE_REJECTED);
            }
        });
    });

    describe('query parser — async parity', () => {
        it('awaits an async hook and prunes the traversed relation', async () => {
            const validate = vi.fn(async (name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = await parser.parseAsync(
                { filters: { 'items.id': '1' }, fields: { items: ['id'] } },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor);
            expect(filterFields(query.filters)).toEqual([]);
            expect(fieldNames(query)).not.toContain('items.id');
        });
    });

    describe('standalone parameter parses enforce too', () => {
        it('prunes a filter traversing a rejected relation', () => {
            const registry = buildRegistry((name: string) => name !== 'items');
            const output = new SimpleFiltersParser(registry).parse(
                { 'items.id': '1' },
                { schema: 'user', context: actor },
            );

            expect(filterFields(output)).toEqual([]);
        });

        it('prunes a field traversing a rejected relation', () => {
            const registry = buildRegistry((name: string) => name !== 'items');
            const output = new SimpleFieldsParser(registry).parse(
                { items: ['id'] },
                { schema: 'user', context: actor },
            );

            expect(output.value.map((field) => field.name)).not.toContain('items.id');
        });

        it('prunes a sort traversing a rejected relation', () => {
            const registry = buildRegistry((name: string) => name !== 'items');
            const output = new SimpleSortParser(registry).parse(
                ['items.id'],
                { schema: 'user', context: actor },
            );

            expect(output.value.map((sort) => sort.name)).not.toContain('items.id');
        });
    });
});

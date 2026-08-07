/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    RelationsParseError,
    SchemaError,
    SchemaRegistry,
    and,
    defineSchema,
    eq,
    preserve,
} from '@rapiq/core';
import type {
    ICondition,
    IFilter,
    IFilters,
    IQuery,
    KeyValidationScope,
} from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimpleParser,
    SimpleSortParser,
} from '../../../src';

type Actor = { permissions: string[] };

const actor : Actor = { permissions: ['realm_read'] };

/**
 * Every relation below sits directly on the (registered) user schema, so the
 * hook always sees the relations parameter at the query root.
 */
const USER_ROOT_SCOPE : KeyValidationScope = {
    parameter: 'relations',
    path: '',
    schema: 'user',
};

/**
 * user → { realm, items(item) }, item → { realm }. The relations validate hook
 * of the user schema is supplied per test; item/realm relations are open.
 */
function buildRegistry(
    validate: (
        name: string,
        context: Actor,
        scope: KeyValidationScope,
    ) => boolean | undefined | Promise<boolean | undefined>,
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

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
            expect(filterFields(query.filters)).toEqual([]);
        });

        it('runs the hook for a relation referenced only by fields and prunes on rejection', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { fields: { items: ['id'] } },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
            expect(fieldNames(query)).not.toContain('items.id');
        });

        it('runs the hook for a relation referenced only by sort and prunes on rejection', () => {
            const validate = vi.fn((name: string) => name !== 'items');
            const parser = new SimpleParser(buildRegistry(validate));

            const query = parser.parse(
                { sort: ['items.id'] },
                { schema: 'user', context: actor },
            );

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

            expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

    /**
     * A filters validate hook may answer with a policy residual scoping the leaf
     * it saw. When that residual names a relation the relations hook rejects,
     * the two hooks contradict each other: pruning the residual would return a
     * wider result set than the policy allows, keeping it would join a rejected
     * relation. The contradiction is a server misconfiguration, so it throws.
     */
    describe('preserved policy residuals vs. relation pruning (#877)', () => {
        function buildScopedRegistry(
            residual: (filter: IFilter) => ICondition,
            relationsValidate: (name: string) => boolean,
        ) : SchemaRegistry {
            const registry = new SchemaRegistry();
            registry.add(defineSchema<Record<string, any>, Actor>({
                name: 'user',
                filters: {
                    allowed: ['id', 'name'],
                    // "you may filter by name, but only within your realms"
                    validate: (filter) => (filter.field === 'name' ?
                        residual(filter) :
                        filter),
                },
                relations: { allowed: ['realm'], validate: relationsValidate },
                schemaMapping: { realm: 'realm' },
            }));
            registry.add(defineSchema({
                name: 'realm',
                filters: { allowed: ['id', 'name'] },
            }));

            return registry;
        }

        const preservedResidual = (filter: IFilter) => preserve(and(filter, eq('realm.id', 'SCOPE')));
        const input = { filters: { name: 'John', 'realm.name': 'master' } };

        it('keeps the residual when the relations hook permits the relation', () => {
            const parser = new SimpleParser(buildScopedRegistry(preservedResidual, () => true));

            const query = parser.parse(input, { schema: 'user', context: actor });
            expect(filterFields(query.filters)).toEqual(['name', 'realm.id', 'realm.name']);
        });

        it('throws instead of pruning the residual when the relation is rejected', () => {
            const parser = new SimpleParser(buildScopedRegistry(
                preservedResidual,
                (name) => name !== 'realm',
            ));

            expect.assertions(2);
            try {
                parser.parse(input, { schema: 'user', context: actor });
            } catch (e) {
                expect(e).toBeInstanceOf(SchemaError);
                expect((e as SchemaError).code).toEqual(ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED);
            }
        });

        it('throws on the async path too', async () => {
            const parser = new SimpleParser(buildScopedRegistry(
                preservedResidual,
                (name) => name !== 'realm',
            ));

            await expect(parser.parseAsync(input, { schema: 'user', context: actor }))
                .rejects.toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws for a standalone filters parse', () => {
            const registry = buildScopedRegistry(preservedResidual, (name) => name !== 'realm');

            expect(() => new SimpleFiltersParser(registry).parse(
                input.filters,
                { schema: 'user', context: actor },
            )).toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        /**
         * The shape the docs recommend: preserve the residual, leave the client's
         * own leaf outside it. Conjunctive composition retains both conditions,
         * while this shape keeps the client leaf prunable, so the gate stays a
         * drop for the client and the error stays reserved for a residual that
         * itself names a rejected relation.
         */
        describe('preserve the residual, not the group', () => {
            const localResidual = (filter: IFilter) => and(filter, preserve(eq('realm_id', 'SCOPE')));
            const relationResidual = (filter: IFilter) => and(filter, preserve(eq('realm.id', 'SCOPE')));

            function buildLocalRegistry(residual: (filter: IFilter) => ICondition) : SchemaRegistry {
                const registry = new SchemaRegistry();
                registry.add(defineSchema<Record<string, any>, Actor>({
                    name: 'user',
                    filters: { allowed: ['id', 'name'], validate: residual },
                    relations: { allowed: ['realm'], validate: (name) => name !== 'realm' },
                    schemaMapping: { realm: 'realm' },
                }));
                registry.add(defineSchema({ name: 'realm', filters: { allowed: ['id', 'name'] } }));

                return registry;
            }

            it('drops the client leaf and keeps the residual, no error', () => {
                const parser = new SimpleParser(buildLocalRegistry(localResidual));

                const query = parser.parse(
                    { filters: { 'realm.name': 'master' } },
                    { schema: 'user', context: actor },
                );

                expect(filterFields(query.filters)).toEqual(['realm_id']);
            });

            it('keeps the residual preserved through normalization', () => {
                const parser = new SimpleParser(buildLocalRegistry(localResidual));

                const query = parser.parse({ filters: { name: 'John' } }, { schema: 'user', context: actor });
                const [group] = query.filters.value as [IFilters];
                const residual = group.value[1] as IFilter;

                expect(residual.field).toBe('realm_id');
                expect(residual.preserved).toBe(true);
                // and it stays marked once normalization hoists it into the root
                expect(query.filters.flatten().value.some((c) => (c as IFilter).preserved)).toBe(true);
            });

            it('still throws when the residual itself names the rejected relation', () => {
                const parser = new SimpleParser(buildLocalRegistry(relationResidual));

                expect(() => parser.parse(
                    { filters: { name: 'John', 'realm.name': 'master' } },
                    { schema: 'user', context: actor },
                )).toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
            });
        });

        it('prunes an unpreserved residual, which is what preserve marks', () => {
            // without preserve() the residual is an ordinary condition:
            // pruning drops it like any other client-owned leaf.
            const parser = new SimpleParser(buildScopedRegistry(
                (filter) => and(filter, eq('realm.id', 'SCOPE')),
                (name) => name !== 'realm',
            ));

            const query = parser.parse(input, { schema: 'user', context: actor });
            expect(filterFields(query.filters)).toEqual(['name']);
        });
    });

    // Tripwire for the resolveKey choke point (plan 022): every wire operator
    // resolves its field through resolveKey, so it must fire the relations hook.
    describe('filter operator matrix — no wire operator escapes the gate', () => {
        const cases : Array<{ label: string, value: string }> = [
            { label: 'eq', value: '1' },
            { label: 'ne', value: '!1' },
            { label: 'gt', value: '>1' },
            { label: 'gte', value: '>=1' },
            { label: 'lt', value: '<9' },
            { label: 'lte', value: '<=9' },
            { label: 'contains', value: '~a~' },
            { label: 'startsWith', value: 'a~' },
            { label: 'endsWith', value: '~a' },
            { label: 'in', value: '1,2' },
            { label: 'nin', value: '!1,2' },
        ];

        for (const { label, value } of cases) {
            it(`fires the hook and prunes a rejected relation for ${label}`, () => {
                const validate = vi.fn((name: string) => name !== 'items');
                const output = new SimpleFiltersParser(buildRegistry(validate)).parse(
                    { 'items.id': value },
                    { schema: 'user', context: actor },
                );

                expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
                expect(filterFields(output)).toEqual([]);
            });
        }
    });
});

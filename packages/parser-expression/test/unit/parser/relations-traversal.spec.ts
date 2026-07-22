/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { IFilters } from '@rapiq/core';
import { ExpressionFiltersParser, ExpressionParser } from '../../../src';

type Actor = { permissions: string[] };

const actor : Actor = { permissions: ['realm_read'] };

function buildRegistry(
    validate: (name: string, context: Actor) => boolean | undefined,
) : SchemaRegistry {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Record<string, any>, Actor>({
        name: 'user',
        filters: { allowed: ['id', 'name', 'items'] },
        relations: { allowed: ['realm', 'items'], validate },
        schemaMapping: { items: 'item', realm: 'realm' },
    }));
    registry.add(defineSchema({
        name: 'item',
        filters: { allowed: ['id'] },
        relations: { allowed: ['realm'] },
    }));
    registry.add(defineSchema({
        name: 'realm',
        filters: { allowed: ['id', 'name'] },
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

describe('expression filters honour relations.validate for traversed paths (#815)', () => {
    it('runs the hook for a dotted field chain and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new ExpressionParser(buildRegistry(validate));

        const query = parser.parse(
            { filters: "eq(items.id, '1')" },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(query.filters)).toEqual([]);
    });

    it('keeps a dotted field chain the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new ExpressionParser(buildRegistry(validate));

        const query = parser.parse(
            { filters: "eq(items.id, '1')" },
            { schema: 'user', context: actor },
        );

        expect(filterFields(query.filters)).toEqual(['items.id']);
    });

    it('runs the hook for an elemMatch relation target and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new ExpressionFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            "elemMatch(items, eq(id, '1'))",
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual([]);
    });

    it('keeps an elemMatch relation target the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new ExpressionFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            "elemMatch(items, eq(id, '1'))",
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual(['items']);
    });

    it('runs the hook for size() on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new ExpressionFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            "size(items, '2')",
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual([]);
    });

    // Tripwire for the resolveKey choke point (plan 022): every expression
    // operator resolves its field chain through resolveKey, so it must fire the
    // relations hook.
    describe('operator matrix — no expression operator escapes the gate', () => {
        const cases : Array<{ label: string, expression: string }> = [
            { label: 'eq', expression: "eq(items.id, '1')" },
            { label: 'gt', expression: "gt(items.id, '1')" },
            { label: 'gte', expression: "gte(items.id, '1')" },
            { label: 'lt', expression: "lt(items.id, '9')" },
            { label: 'lte', expression: "lte(items.id, '9')" },
            { label: 'in', expression: "in(items.id, '1', '2')" },
            { label: 'nin', expression: "nin(items.id, '1')" },
            { label: 'contains', expression: "contains(items.id, 'a')" },
            { label: 'startsWith', expression: "startsWith(items.id, 'a')" },
            { label: 'endsWith', expression: "endsWith(items.id, 'a')" },
            { label: 'size (direct relation)', expression: "size(items, '2')" },
            { label: 'elemMatch (direct relation)', expression: "elemMatch(items, eq(id, '1'))" },
        ];

        for (const { label, expression } of cases) {
            it(`fires the hook and prunes a rejected relation for ${label}`, () => {
                const validate = vi.fn((name: string) => name !== 'items');
                const output = new ExpressionFiltersParser(buildRegistry(validate)).parse(
                    expression,
                    { schema: 'user', context: actor },
                );

                expect(validate).toHaveBeenCalledWith('items', actor);
                expect(filterFields(output)).toEqual([]);
            });
        }
    });
});

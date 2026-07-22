/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { IFilters } from '@rapiq/core';
import { MongoFiltersParser, MongoParser } from '../../../src';

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

describe('mongo filters honour relations.validate for traversed paths (#815)', () => {
    it('runs the hook for a dotted filter key and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoParser(buildRegistry(validate));

        const query = parser.parse(
            { filters: { 'items.id': 1 } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(query.filters)).toEqual([]);
    });

    it('keeps a dotted filter key the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new MongoParser(buildRegistry(validate));

        const query = parser.parse(
            { filters: { 'items.id': 1 } },
            { schema: 'user', context: actor },
        );

        expect(filterFields(query.filters)).toEqual(['items.id']);
    });

    it('runs the hook for an $elemMatch relation target and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $elemMatch: { id: 1 } } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual([]);
    });

    it('keeps an $elemMatch relation target the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $elemMatch: { id: 1 } } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual(['items']);
    });

    it('runs the hook for $all on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $all: [1] } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual([]);
    });

    it('runs the hook for $size on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $size: 2 } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor);
        expect(filterFields(output)).toEqual([]);
    });

    // A tripwire for the resolveKey choke point (plan 022): every operator that
    // reaches a relation resolves its field through resolveKey, so it must fire
    // the relations hook. If a new operator is added that resolves a field some
    // other way, one of these fails — surfacing the bypass instead of shipping it.
    describe('operator matrix — no operator escapes the relations gate', () => {
        const dotted : Array<{ label: string, value: unknown }> = [
            { label: 'bare eq', value: 1 },
            { label: '$ne', value: { $ne: 1 } },
            { label: '$gt', value: { $gt: 1 } },
            { label: '$gte', value: { $gte: 1 } },
            { label: '$lt', value: { $lt: 9 } },
            { label: '$lte', value: { $lte: 9 } },
            { label: '$in', value: { $in: [1, 2] } },
            { label: '$nin', value: { $nin: [1] } },
            { label: '$exists', value: { $exists: true } },
            { label: '$mod', value: { $mod: [2, 0] } },
            { label: '$regex', value: { $regex: '^a' } },
            { label: '$contains', value: { $contains: 'a' } },
            { label: '$startsWith', value: { $startsWith: 'a' } },
            { label: 'bare array ($in)', value: [1, 2] },
            { label: '$not', value: { $not: { $gt: 1 } } },
        ];

        for (const { label, value } of dotted) {
            it(`fires the hook and prunes a rejected relation for ${label}`, () => {
                const validate = vi.fn((name: string) => name !== 'items');
                const output = new MongoFiltersParser(buildRegistry(validate)).parse(
                    { 'items.id': value },
                    { schema: 'user', context: actor },
                );

                expect(validate).toHaveBeenCalledWith('items', actor);
                expect(filterFields(output)).toEqual([]);
            });
        }

        const direct : Array<{ label: string, value: unknown }> = [
            { label: '$size', value: { $size: 2 } },
            { label: '$all', value: { $all: [1] } },
            { label: '$elemMatch', value: { $elemMatch: { id: 1 } } },
        ];

        for (const { label, value } of direct) {
            it(`fires the hook and prunes a rejected relation for a direct ${label}`, () => {
                const validate = vi.fn((name: string) => name !== 'items');
                const output = new MongoFiltersParser(buildRegistry(validate)).parse(
                    { items: value },
                    { schema: 'user', context: actor },
                );

                expect(validate).toHaveBeenCalledWith('items', actor);
                expect(filterFields(output)).toEqual([]);
            });
        }
    });
});

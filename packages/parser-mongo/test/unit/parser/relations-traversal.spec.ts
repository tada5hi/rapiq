/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaRegistry, defineSchema } from '@rapiq/core';
import type { IFilters, KeyValidationScope } from '@rapiq/core';
import { expectRejected } from '../../data';
import { MongoFiltersParser, MongoParser } from '../../../src';

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

function buildRegistry(
    validate: (
        name: string,
        context: Actor,
        scope: KeyValidationScope,
    ) => boolean | undefined,
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

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
        expect(filterFields(output)).toEqual([]);
    });

    it('keeps an $elemMatch relation target the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $elemMatch: { id: 1 } } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
        expect(filterFields(output)).toEqual(['items']);
    });

    it('runs the hook for $all on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $all: [1] } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
        expect(filterFields(output)).toEqual([]);
    });

    it('runs the hook for $size on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new MongoFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            { items: { $size: 2 } },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

                expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

                expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
                expect(filterFields(output)).toEqual([]);
            });
        }
    });
});

/**
 * post allows the relation postTags only; author is a registered schema and
 * a filterable key of post, but no relation post allows (#1001).
 */
function buildGateRegistry() : SchemaRegistry {
    const registry = new SchemaRegistry();

    registry.add(defineSchema({
        name: 'post',
        filters: { allowed: ['id', 'postTags', 'author'] },
        relations: { allowed: ['postTags'] },
    }));
    registry.add(defineSchema({ name: 'postTags', filters: { allowed: ['tagId'] } }));
    registry.add(defineSchema({ name: 'author', filters: { allowed: ['userId'] } }));

    return registry;
}

describe('mongo relation-array operators honour the relation gate (#1001)', () => {
    const operators : Array<{ label: string, value: unknown }> = [
        { label: '$size', value: { $size: 2 } },
        { label: '$all', value: { $all: ['x'] } },
        { label: '$elemMatch', value: { $elemMatch: { userId: 'x' } } },
    ];

    for (const { label, value } of operators) {
        it(`drops or rejects ${label} on a relation the schema does not allow`, () => {
            const parser = new MongoParser(buildGateRegistry());
            const input = { filters: { author: value } };

            expect(filterFields(parser.parse(input, { schema: 'post' }).filters)).toEqual([]);
            expectRejected(
                () => parser.parse(input, { schema: 'post', throwOnFailure: true }),
                { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
            );
        });
    }

    it('never asks the relations hook about a target the gate rejects', () => {
        const seen : string[] = [];
        const registry = new SchemaRegistry();

        registry.add(defineSchema({
            name: 'post',
            filters: { allowed: ['id', 'author'] },
            relations: {
                allowed: ['postTags'],
                validate: (name: string) => {
                    seen.push(name);

                    return true;
                },
            },
        }));
        registry.add(defineSchema({ name: 'author', filters: { allowed: ['userId'] } }));

        const parser = new MongoParser(registry);
        let issues : unknown[] = [];

        try {
            parser.parse({ filters: { author: { $size: 1 } } }, { schema: 'post', throwOnFailure: true });
        } catch (e) {
            issues = (e as { issues: unknown[] }).issues;
        }

        expect(seen).toEqual([]);
        expect(issues).toHaveLength(1);
    });

    it('keeps $size on an allowed relation', () => {
        const parser = new MongoParser(buildGateRegistry());

        const query = parser.parse(
            { filters: { postTags: { $size: 2 } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(filterFields(query.filters)).toEqual(['postTags']);
    });

    it('never gates a scalar comparison on a key matching a registered schema', () => {
        const parser = new MongoParser(buildGateRegistry());

        for (const filters of [{ author: 'x' }, { author: { $ne: 'x' } }, { author: { $gt: 'x' } }]) {
            const query = parser.parse({ filters }, { schema: 'post', throwOnFailure: true });

            expect(filterFields(query.filters)).toEqual(['author']);
        }
    });

    it('never keeps $not around an array operator on a relation the schema does not allow', () => {
        const parser = new MongoParser(buildGateRegistry());

        // a negated array operator has no complement twin: the grammar
        // rejects it before any key resolution, under either policy, so
        // the relation can not be reached through $not.
        for (const operator of [{ $size: 2 }, { $all: ['x'] }, { $elemMatch: { userId: 'x' } }]) {
            const input = { filters: { author: { $not: operator } } };

            for (const throwOnFailure of [false, true]) {
                expectRejected(
                    () => parser.parse(input, { schema: 'post', throwOnFailure }),
                    { code: ErrorCode.OPERATOR_UNSUPPORTED },
                );
            }
        }
    });
});

/**
 * `secrets` and `drafts` are declared relations of post through
 * `schemaMapping`, but neither target schema is registered; only `drafts`
 * is allowed. `notes` is an undeclared, unregistered JSON column (#1001).
 */
function buildUnregisteredRegistry() : SchemaRegistry {
    const registry = new SchemaRegistry();

    registry.add(defineSchema({
        name: 'post',
        relations: { allowed: ['tags', 'drafts'] },
        schemaMapping: { secrets: 'secretUnreg', drafts: 'draftUnreg' },
    }));
    registry.add(defineSchema({ name: 'tags' }));

    return registry;
}

describe('mongo array operators on an unregistered declared relation (#1001)', () => {
    const operators : Array<{ label: string, value: unknown }> = [
        { label: '$size', value: { $size: 0 } },
        { label: '$elemMatch', value: { $elemMatch: { name: 'x' } } },
    ];

    for (const { label, value } of operators) {
        it(`drops or rejects ${label} on a schemaMapping relation outside the allowed list`, () => {
            const parser = new MongoParser(buildUnregisteredRegistry());
            const input = { filters: { secrets: value } };

            expect(filterFields(parser.parse(input, { schema: 'post' }).filters)).toEqual([]);
            expectRejected(
                () => parser.parse(input, { schema: 'post', throwOnFailure: true }),
                { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
            );
        });

        it(`keeps ${label} on an allowed schemaMapping relation`, () => {
            const parser = new MongoParser(buildUnregisteredRegistry());

            const query = parser.parse(
                { filters: { drafts: value } },
                { schema: 'post', throwOnFailure: true },
            );

            expect(filterFields(query.filters)).toEqual(['drafts']);
        });

        it(`keeps ${label} on an undeclared JSON column`, () => {
            const parser = new MongoParser(buildUnregisteredRegistry());

            const query = parser.parse(
                { filters: { notes: value } },
                { schema: 'post', throwOnFailure: true },
            );

            expect(filterFields(query.filters)).toEqual(['notes']);
        });
    }
});

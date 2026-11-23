/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    SchemaRegistry,
    defineFiltersSchema,
    defineSchema,
} from '@rapiq/core';
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

/**
 * The schema of #1005: post may traverse postTags only, author is a
 * registered schema post does not allow, `tags` is a JSON array column.
 */
function buildArrayRegistry(
    filters: Record<string, any> = {},
    post: Record<string, any> = {},
    validate?: (name: string) => boolean,
) : SchemaRegistry {
    const registry = new SchemaRegistry();

    registry.add(defineSchema({
        name: 'post',
        relations: { allowed: ['cover'], ...(validate ? { validate } : {}) },
        filters: {
            allowed: ['id', 'slug', 'tags', 'postTags'],
            relations: ['postTags'],
            ...filters,
        },
        ...post,
    }));
    registry.add(defineSchema({
        name: 'postTags',
        filters: { allowed: ['tagId'], relations: [] },
        schemaMapping: { post: 'post' },
    }));
    registry.add(defineSchema({ name: 'author', filters: { allowed: ['userId'] } }));
    registry.add(defineSchema({ name: 'cover' }));

    return registry;
}

/**
 * Every field of a parsed tree, elemMatch interiors included.
 */
function treeFields(input: unknown) : string[] {
    const output : string[] = [];
    const walk = (node: any) => {
        if (typeof node?.field === 'string') {
            output.push(node.field);

            if (node.operator === 'elemMatch') {
                walk(node.value);
            }

            return;
        }

        if (Array.isArray(node?.value)) {
            for (const child of node.value) {
                walk(child);
            }
        }
    };

    walk(input);

    return output;
}

describe('mongo array operator interiors and targets (#1005)', () => {
    it('resolves the interior of a non-relation target as an element path', () => {
        const validate = vi.fn(() => true);
        const parser = new MongoParser(buildArrayRegistry({}, {}, validate));

        const query = parser.parse(
            { filters: { id: { $elemMatch: { 'author.userId': 'x' } } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['id', 'author.userId']);
        expect(validate).not.toHaveBeenCalled();
    });

    it('never reaches a relation from an element interior', () => {
        const parser = new MongoParser(buildArrayRegistry());

        const query = parser.parse(
            { filters: { slug: { $elemMatch: { 'postTags.post.status': 'draft' } } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['slug', 'postTags.post.status']);
    });

    const refused : Array<{ label: string, filters: Record<string, unknown> }> = [
        { label: '$elemMatch', filters: { id: { $elemMatch: { 'author.userId': 'x' } } } },
        { label: '$size', filters: { id: { $size: 1 } } },
        { label: '$all', filters: { id: { $all: ['x'] } } },
        { label: '$elemMatch (relation path interior)', filters: { slug: { $elemMatch: { 'postTags.post.status': 'draft' } } } },
    ];

    for (const { label, filters } of refused) {
        it(`drops or rejects ${label} on a field outside an empty arrays list`, () => {
            const parser = new MongoParser(buildArrayRegistry({ arrays: [] }));
            const input = { filters };

            expect(treeFields(parser.parse(input, { schema: 'post' }).filters)).toEqual([]);
            expectRejected(
                () => parser.parse(input, { schema: 'post', throwOnFailure: true }),
                { code: ErrorCode.KEY_NOT_ALLOWED },
            );
        });

        it(`drops ${label} under a strict schema without arrays`, () => {
            const parser = new MongoParser(buildArrayRegistry({}, { strict: true }));

            expect(treeFields(parser.parse({ filters }, { schema: 'post' }).filters)).toEqual([]);
        });
    }

    it('keeps a sibling entry when an array target is dropped', () => {
        const parser = new MongoParser(buildArrayRegistry({ arrays: [] }));

        const query = parser.parse(
            { filters: { id: { $size: 1 }, slug: 'x' } },
            { schema: 'post' },
        );

        expect(treeFields(query.filters)).toEqual(['slug']);
    });

    it('keeps array operators on a declared array column', () => {
        const parser = new MongoParser(buildArrayRegistry({ arrays: ['tags'] }, { strict: true }));

        for (const filters of [
            { tags: { $size: 1 } },
            { tags: { $all: ['x'] } },
            { tags: { $elemMatch: { 'meta.kind': 'x' } } },
        ]) {
            const query = parser.parse({ filters }, { schema: 'post', throwOnFailure: true });

            expect(treeFields(query.filters)[0]).toEqual('tags');
        }
    });

    it('keeps binding a relation target to its schema', () => {
        const parser = new MongoParser(buildArrayRegistry({ arrays: [] }));

        expect(treeFields(parser.parse(
            { filters: { postTags: { $elemMatch: { tagId: 'x' } } } },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags', 'tagId']);
        expect(treeFields(parser.parse(
            { filters: { postTags: { $size: 1 } } },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags']);

        // the postTags schema permits no relation: its hop is gated
        expectRejected(
            () => parser.parse(
                { filters: { postTags: { $elemMatch: { 'post.status': 'draft' } } } },
                { schema: 'post', throwOnFailure: true },
            ),
            { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
        );
    });

    it('keeps nested interiors element scopes at every depth', () => {
        const parser = new MongoParser(buildArrayRegistry({ arrays: ['tags'] }));

        const query = parser.parse(
            { filters: { tags: { $elemMatch: { sub: { $elemMatch: { 'author.userId': 'x' } } } } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['tags', 'sub', 'author.userId']);

        const itself = parser.parse(
            { filters: { tags: { $elemMatch: { $gt: 1 } } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(itself.filters)).toEqual(['tags', '$this']);
    });

    it('treats a listed array column as no relation even when a schema shares its name', () => {
        const validate = vi.fn(() => true);
        const parser = new MongoParser(buildArrayRegistry({
            allowed: ['id', 'author'],
            arrays: ['author'],
        }, {}, validate));

        const query = parser.parse(
            { filters: { author: { $elemMatch: { 'anything.deep': 'x' } } } },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['author', 'anything.deep']);
        expect(validate).not.toHaveBeenCalled();
    });
});

/**
 * post declares the relation author, whose schema is not registered;
 * company is registered (#1005 review).
 */
function buildDeclaredRegistry() : SchemaRegistry {
    const registry = new SchemaRegistry();

    registry.add(defineSchema({
        name: 'post',
        relations: { allowed: ['author'] },
        filters: { allowed: ['id', 'author'] },
    }));
    registry.add(defineSchema({ name: 'company', filters: { allowed: ['name'] } }));

    return registry;
}

describe('mongo ITSELF and unregistered relation interiors (#1005)', () => {
    it('keeps a bound relation interior for the element form, gating every hop', () => {
        const parser = new MongoParser(buildArrayRegistry());
        const input = { filters: { postTags: { $elemMatch: { $elemMatch: { 'post.secret': 'x' } } } } };

        expect(treeFields(parser.parse(input, { schema: 'post' }).filters)).toEqual([]);
        expectRejected(
            () => parser.parse(input, { schema: 'post', throwOnFailure: true }),
            { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
        );

        expect(treeFields(parser.parse(
            { filters: { postTags: { $elemMatch: { $elemMatch: { tagId: 'x' } } } } },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags', '$this', 'tagId']);
    });

    it('keeps a single-segment key inside a declared but unregistered relation', () => {
        const parser = new MongoParser(buildDeclaredRegistry());

        expect(treeFields(parser.parse(
            { filters: { author: { $elemMatch: { name: 'x' } } } },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['author', 'name']);
    });

    const dotted : Array<Record<string, unknown>> = [
        { author: { $elemMatch: { 'company.secret': 'x' } } },
        { author: { $elemMatch: { sub: { $elemMatch: { 'company.name': 'x' } } } } },
        { author: { $elemMatch: { $elemMatch: { 'company.name': 'x' } } } },
        // an array-operator target inside the row: it may be a relation
        { author: { $elemMatch: { company: { $elemMatch: { secret: 'x' } } } } },
        { author: { $elemMatch: { company: { $size: 1 } } } },
        { author: { $elemMatch: { company: { $all: ['x'] } } } },
    ];

    for (const filters of dotted) {
        it(`drops or rejects ${JSON.stringify(filters)}: a join behind an unregistered relation`, () => {
            const parser = new MongoParser(buildDeclaredRegistry());

            expect(treeFields(parser.parse({ filters }, { schema: 'post' }).filters)).toEqual([]);
            expectRejected(
                () => parser.parse({ filters }, { schema: 'post', throwOnFailure: true }),
                { code: ErrorCode.KEY_PATH_INVALID },
            );
        });
    }
});

describe('mongo array operators on a standalone filters schema (PR #1007 review)', () => {
    const operators : Array<{ label: string, value: unknown }> = [
        { label: '$size', value: { $size: 1 } },
        { label: '$all', value: { $all: ['x'] } },
        { label: '$elemMatch', value: { $elemMatch: { tagId: 'x' } } },
    ];

    for (const { label, value } of operators) {
        it(`keeps ${label} on a registered relation an explicit arrays list omits`, () => {
            const parser = new MongoFiltersParser(buildArrayRegistry());

            const output = parser.parse({ postTags: value }, {
                schema: defineFiltersSchema({
                    allowed: ['postTags'], 
                    relations: ['postTags'], 
                    arrays: [], 
                }),
                throwOnFailure: true,
            });

            expect(treeFields(output)[0]).toEqual('postTags');
        });
    }

    it('drops or rejects an empty dotted segment inside an element interior', () => {
        const parser = new MongoParser(buildArrayRegistry({ arrays: ['tags'] }));
        const input = { filters: { tags: { $elemMatch: { 'a..b': 1 } } } };

        expect(treeFields(parser.parse(input, { schema: 'post' }).filters)).toEqual([]);
        expectRejected(
            () => parser.parse(input, { schema: 'post', throwOnFailure: true }),
            { code: ErrorCode.KEY_INVALID },
        );
    });
});

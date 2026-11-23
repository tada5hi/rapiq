/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode, SchemaRegistry, defineSchema } from '@rapiq/core';
import type { IFilters, KeyValidationScope } from '@rapiq/core';
import { expectRejected } from '../../data';
import { ExpressionFiltersParser, ExpressionParser } from '../../../src';

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

describe('expression filters honour relations.validate for traversed paths (#815)', () => {
    it('runs the hook for a dotted field chain and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new ExpressionParser(buildRegistry(validate));

        const query = parser.parse(
            { filters: "eq(items.id, '1')" },
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
        expect(filterFields(output)).toEqual([]);
    });

    it('keeps an elemMatch relation target the actor may traverse', () => {
        const validate = vi.fn(() => true);
        const parser = new ExpressionFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            "elemMatch(items, eq(id, '1'))",
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
        expect(filterFields(output)).toEqual(['items']);
    });

    it('runs the hook for size() on a relation and prunes on rejection', () => {
        const validate = vi.fn((name: string) => name !== 'items');
        const parser = new ExpressionFiltersParser(buildRegistry(validate));

        const output = parser.parse(
            "size(items, '2')",
            { schema: 'user', context: actor },
        );

        expect(validate).toHaveBeenCalledWith('items', actor, USER_ROOT_SCOPE);
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

describe('expression relation-array operators honour the relation gate (#1001)', () => {
    const rejected = [
        "size(author, '2')",
        "elemMatch(author, eq(userId, 'x'))",
    ];

    for (const expression of rejected) {
        it(`rejects ${expression} on a relation the schema does not allow`, () => {
            const parser = new ExpressionParser(buildGateRegistry());
            const input = { filters: expression };

            // an expression cannot be partially reinterpreted: key
            // violations reject under either failure policy.
            for (const throwOnFailure of [false, true]) {
                expectRejected(
                    () => parser.parse(input, { schema: 'post', throwOnFailure }),
                    { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
                );
            }
        });
    }

    const kept = [
        "size(postTags, '2')",
        "elemMatch(postTags, eq(tagId, 'x'))",
    ];

    for (const expression of kept) {
        it(`keeps ${expression} on an allowed relation`, () => {
            const parser = new ExpressionParser(buildGateRegistry());

            const query = parser.parse({ filters: expression }, { schema: 'post', throwOnFailure: true });

            expect(filterFields(query.filters)).toEqual(['postTags']);
        });
    }

    it('never gates a scalar comparison on a key matching a registered schema', () => {
        const parser = new ExpressionParser(buildGateRegistry());

        for (const filters of ["eq(author, 'x')", "lt(author, 'x')", "gt(author, 'x')"]) {
            const query = parser.parse({ filters }, { schema: 'post', throwOnFailure: true });

            expect(filterFields(query.filters)).toEqual(['author']);
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

describe('expression array operators on an unregistered declared relation (#1001)', () => {
    const operators = [
        (field: string) => `size(${field}, '0')`,
        (field: string) => `elemMatch(${field}, eq(name, 'x'))`,
    ];

    for (const build of operators) {
        it(`rejects ${build('secrets')} on a schemaMapping relation outside the allowed list`, () => {
            const parser = new ExpressionParser(buildUnregisteredRegistry());
            const input = { filters: build('secrets') };

            for (const throwOnFailure of [false, true]) {
                expectRejected(
                    () => parser.parse(input, { schema: 'post', throwOnFailure }),
                    { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
                );
            }
        });

        for (const field of ['drafts', 'notes']) {
            it(`keeps ${build(field)}`, () => {
                const parser = new ExpressionParser(buildUnregisteredRegistry());

                const query = parser.parse(
                    { filters: build(field) },
                    { schema: 'post', throwOnFailure: true },
                );

                expect(filterFields(query.filters)).toEqual([field]);
            });
        }
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

describe('expression array operator interiors and targets (#1005)', () => {
    it('resolves the interior of a non-relation target as an element path', () => {
        const validate = vi.fn(() => true);
        const parser = new ExpressionParser(buildArrayRegistry({}, {}, validate));

        const query = parser.parse(
            { filters: "elemMatch(id, eq(author.userId, 'x'))" },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['id', 'author.userId']);
        // not a relation traversal: the relations hook never sees author
        expect(validate).not.toHaveBeenCalled();
    });

    it('never reaches a relation from an element interior', () => {
        const parser = new ExpressionParser(buildArrayRegistry());

        const query = parser.parse(
            { filters: "elemMatch(slug, eq(postTags.post.status, 'draft'))" },
            { schema: 'post', throwOnFailure: true },
        );

        expect(treeFields(query.filters)).toEqual(['slug', 'postTags.post.status']);
    });

    const refused = [
        "elemMatch(id, eq(author.userId, 'x'))",
        "size(id, '1')",
        "elemMatch(slug, eq(postTags.post.status, 'draft'))",
    ];

    for (const expression of refused) {
        it(`rejects ${expression} when arrays is declared empty`, () => {
            const parser = new ExpressionParser(buildArrayRegistry({ arrays: [] }));

            for (const throwOnFailure of [false, true]) {
                expectRejected(
                    () => parser.parse({ filters: expression }, { schema: 'post', throwOnFailure }),
                    { code: ErrorCode.KEY_NOT_ALLOWED },
                );
            }
        });

        it(`rejects ${expression} under a strict schema without arrays`, () => {
            const parser = new ExpressionParser(buildArrayRegistry({}, { strict: true }));

            expectRejected(
                () => parser.parse({ filters: expression }, { schema: 'post' }),
                { code: ErrorCode.KEY_NOT_ALLOWED },
            );
        });
    }

    it('keeps array operators on a declared array column', () => {
        const parser = new ExpressionParser(buildArrayRegistry({ arrays: ['tags'] }, { strict: true }));

        for (const filters of ["size(tags, '1')", "elemMatch(tags, eq(meta.kind, 'x'))"]) {
            const query = parser.parse({ filters }, { schema: 'post', throwOnFailure: true });

            expect(treeFields(query.filters)[0]).toEqual('tags');
        }
    });

    it('keeps binding a relation target to its schema', () => {
        const parser = new ExpressionParser(buildArrayRegistry({ arrays: [] }));

        expect(treeFields(parser.parse(
            { filters: "elemMatch(postTags, eq(tagId, 'x'))" },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags', 'tagId']);
        expect(treeFields(parser.parse(
            { filters: "size(postTags, '1')" },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags']);

        // the postTags schema permits no relation: its hop is gated
        expectRejected(
            () => parser.parse(
                { filters: "elemMatch(postTags, eq(post.status, 'draft'))" },
                { schema: 'post', throwOnFailure: true },
            ),
            { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
        );
    });

    it('keeps nested interiors element scopes at every depth', () => {
        const parser = new ExpressionParser(buildArrayRegistry({ arrays: ['tags'] }));

        for (const [filters, inner] of [
            ["elemMatch(tags, elemMatch(sub, eq(author.userId, 'x')))", 'sub'],
            ["elemMatch(tags, elemMatch($this, eq(author.userId, 'x')))", '$this'],
        ]) {
            const query = parser.parse({ filters }, { schema: 'post', throwOnFailure: true });

            expect(treeFields(query.filters)).toEqual(['tags', inner, 'author.userId']);
        }
    });

    it('treats a listed array column as no relation even when a schema shares its name', () => {
        const validate = vi.fn(() => true);
        const parser = new ExpressionParser(buildArrayRegistry({
            allowed: ['id', 'author'],
            arrays: ['author'],
        }, {}, validate));

        const query = parser.parse(
            { filters: "elemMatch(author, eq(anything.deep, 'x'))" },
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

describe('expression ITSELF and unregistered relation interiors (#1005)', () => {
    it('keeps a bound relation interior for an ITSELF target, gating every hop', () => {
        const parser = new ExpressionParser(buildArrayRegistry());
        const input = { filters: "elemMatch(postTags, elemMatch($this, eq(post.secret, 'x')))" };

        for (const throwOnFailure of [false, true]) {
            expectRejected(
                () => parser.parse(input, { schema: 'post', throwOnFailure }),
                { code: ErrorCode.KEY_PATH_NOT_ALLOWED },
            );
        }

        expect(treeFields(parser.parse(
            { filters: "elemMatch(postTags, elemMatch($this, eq(tagId, 'x')))" },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['postTags', '$this', 'tagId']);
    });

    it('keeps a single-segment key inside a declared but unregistered relation', () => {
        const parser = new ExpressionParser(buildDeclaredRegistry());

        expect(treeFields(parser.parse(
            { filters: "elemMatch(author, eq(name, 'x'))" },
            { schema: 'post', throwOnFailure: true },
        ).filters)).toEqual(['author', 'name']);
    });

    const dotted = [
        "elemMatch(author, eq(company.secret, 'x'))",
        "elemMatch(author, elemMatch(sub, eq(company.name, 'x')))",
        "elemMatch(author, elemMatch($this, eq(company.name, 'x')))",
        // an array-operator target inside the row: it may be a relation
        "elemMatch(author, elemMatch(company, eq(secret, 'x')))",
        "elemMatch(author, size(company, '1'))",
    ];

    for (const filters of dotted) {
        it(`rejects ${filters}: a join behind an unregistered relation`, () => {
            const parser = new ExpressionParser(buildDeclaredRegistry());

            for (const throwOnFailure of [false, true]) {
                expectRejected(
                    () => parser.parse({ filters }, { schema: 'post', throwOnFailure }),
                    { code: ErrorCode.KEY_PATH_INVALID },
                );
            }
        });
    }
});

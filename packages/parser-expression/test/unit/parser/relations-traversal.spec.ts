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

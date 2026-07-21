/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { IFilters, IQuery } from '@rapiq/core';
import { createURLCodec } from '../../src';

type Actor = { permissions: string[] };

const actor : Actor = { permissions: ['userRole_read'] };

/**
 * userRole → { user }. The `user` relation is denied to the acting identity —
 * exactly the authup junction-list scenario from #815.
 */
function buildRegistry() : SchemaRegistry {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Record<string, any>, Actor>({
        name: 'userRole',
        fields: { allowed: ['id'] },
        filters: { allowed: ['id'] },
        sort: { allowed: ['id'] },
        relations: {
            allowed: ['user'],
            validate: (name, context) => context.permissions.includes(`${name}_read`),
        },
        schemaMapping: { user: 'user' },
    }));
    registry.add(defineSchema({
        name: 'user',
        fields: { allowed: ['id', 'name', 'email'] },
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

describe('decode() honours relations.validate for auto-joined paths (#815)', () => {
    describe('simple (legacy bracket) dialect', () => {
        it('does not let filter[user.name] bypass the relations gate', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { filter: { 'user.name': 'admin' } },
                { schema: 'userRole', context: actor },
            ) as IQuery;

            expect(filterFields(query.filters)).toEqual([]);
        });

        it('does not let fields[user]=email materialize the denied member', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { fields: { user: 'email' } },
                { schema: 'userRole', context: actor },
            ) as IQuery;

            expect(query.fields.value.map((field) => field.name)).not.toContain('user.email');
        });

        it('does not let sort=user.name reach through the denied relation', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { sort: 'user.name' },
                { schema: 'userRole', context: actor },
            ) as IQuery;

            expect(query.sorts.value.map((sort) => sort.name)).not.toContain('user.name');
        });

        it('keeps the path when the actor may read the relation', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { filter: { 'user.name': 'admin' } },
                { schema: 'userRole', context: { permissions: ['userRole_read', 'user_read'] } },
            ) as IQuery;

            expect(filterFields(query.filters)).toEqual(['user.name']);
        });
    });

    describe('expression dialect', () => {
        it('does not let an expression filter bypass the relations gate', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { filter: "eq(user.name, 'admin')" },
                { schema: 'userRole', context: actor },
            ) as IQuery;

            expect(filterFields(query.filters)).toEqual([]);
        });

        it('keeps the expression path when the actor may read the relation', () => {
            const codec = createURLCodec(buildRegistry());

            const query = codec.decode(
                { filter: "eq(user.name, 'admin')" },
                { schema: 'userRole', context: { permissions: ['userRole_read', 'user_read'] } },
            ) as IQuery;

            expect(filterFields(query.filters)).toEqual(['user.name']);
        });
    });
});

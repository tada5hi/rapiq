/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createURLCodec } from '@rapiq/codec-url';
import type { Schema } from '@rapiq/core';
import { 
    Query, 
    SchemaRegistry, 
    defineSchema, 
    eq, 
} from '@rapiq/core';
import type { Args } from '../../src';
import { PrismaAdapter, defineSchemaRegistryWithDatamodel } from '../../src';
import { selectRows } from '../data/evaluate';
import { createAdapterOptions, createRegistry } from '../data/schema';
import { datamodel } from '../data/datamodel';
import type { User } from '../data/type';

const records : User[] = [
    {
        id: 1,
        first_name: 'Caleb',
        last_name: 'Barrows',
        email: 'caleb.barrows@gmail.com',
        age: 18,
        address: 'Hogwarts',
        realm_id: null,
        realm: null,
        items: [],
    },
    {
        id: 2,
        first_name: 'Aston',
        last_name: 'Nel',
        email: 'ashton.nel@gmail.com',
        age: 60,
        address: null,
        realm_id: 1,
        realm: {
            id: 1, 
            name: 'master', 
            description: null, 
        },
        items: [{
            id: 1, 
            title: 'book', 
            color: 'red', 
        }],
    },
];

/**
 * M2 gate archetype, ported to the args-object adapter: a repository
 * takes raw client input, validates it against a schema and hands the
 * result to prisma.
 */
function createUserRepository(schema?: Schema<User>) {
    let registry : SchemaRegistry;

    if (schema) {
        registry = new SchemaRegistry();
        registry.add(schema);
    } else {
        registry = createRegistry();
    }

    const codec = createURLCodec(registry);
    const adapter = new PrismaAdapter(createAdapterOptions());

    return {
        findMany(input: string | Record<string, any>, base?: Args) {
            const query = codec.decode(input, { schema: 'user' });
            expect(query).toBeDefined();

            return adapter.execute(query!, { base });
        },
    };
}

describe('acceptance: derived registry to prisma arguments', () => {
    it('should decode against a derived schema and serialize', () => {
        // shape from the datamodel, authorization explicit per model.
        const registry = defineSchemaRegistryWithDatamodel(datamodel, {
            schemas: {
                user: {
                    fields: { default: ['id', 'first_name'] },
                    filters: { allowed: ['age', 'realm.name'] },
                    sort: { allowed: ['age'] },
                },
                realm: {
                    fields: { allowed: 'inherit' },
                    filters: { allowed: ['name'] },
                },
            },
        });

        const codec = createURLCodec(registry);
        const adapter = new PrismaAdapter(createAdapterOptions());

        const query = codec.decode(
            'filter[age]=18&filter[realm.name]=master&include=realm&sort=-age',
            { schema: 'user' },
        );

        const { args } = adapter.execute(query!);

        expect(args.where).toEqual({
            AND: [
                { age: { equals: 18 } },
                { realm: { is: { name: { equals: 'master', mode: 'insensitive' } } } },
            ],
        });
        // the include narrows to the realm schema's fieldset — here the
        // inherited datamodel columns (#847)
        expect(args.select).toEqual({
            id: true,
            first_name: true,
            realm: {
                select: {
                    id: true, 
                    name: true, 
                    description: true, 
                }, 
            },
        });
        expect(args.orderBy).toEqual([{ age: 'desc' }]);
    });
});

describe('acceptance: request query to prisma arguments', () => {
    const repository = createUserRepository();

    it('should map a full client request', () => {
        const { args, pagination } = repository.findMany(
            'fields=%2Bemail&filter[realm_id]=1,null&include=realm&sort=-age&page[limit]=100',
        );

        // the requested limit is clamped to maxLimit and echoed back
        expect(pagination).toEqual({ limit: 50, offset: 0 });

        expect(args.take).toEqual(50);
        expect(args.skip).toEqual(0);
        expect(args.orderBy).toEqual([{ age: 'desc' }]);

        // null-aware membership: records of the realm *or* without one
        expect(args.where).toEqual({
            OR: [
                { realm_id: { in: [1] } },
                { realm_id: null },
            ],
        });

        // the sensitive field is projected only because the client
        // opted in; the hydrated relation joins the same select level,
        // narrowed to the realm schema's allow-listed fieldset (#847).
        expect(args.select).toEqual({
            id: true,
            first_name: true,
            last_name: true,
            age: true,
            email: true,
            realm: {
                select: {
                    id: true, 
                    name: true, 
                    description: true, 
                }, 
            },
        });

        expect(selectRows(args.where, records).map((record) => record.id)).toEqual([1, 2]);
    });

    it('should hide undeclared parameters', () => {
        const { args, pagination } = repository.findMany({
            filter: { age: '18' },
            sort: '-email',
        });

        expect(pagination).toEqual({ limit: 50, offset: 0 });

        // age is filterable, email is not sortable
        expect(args.where).toEqual({ age: { equals: 18 } });
        expect(args.orderBy).toBeUndefined();

        expect(args.select).toEqual({
            id: true,
            first_name: true,
            last_name: true,
            age: true,
        });
    });

    it('should enforce server-injected scoping regardless of client input', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema<User>({
            name: 'user',
            filters: { allowed: ['first_name'] },
        }));

        const codec = createURLCodec(registry);
        const adapter = new PrismaAdapter(createAdapterOptions());

        const applyScoped = (input: string) => {
            const query = codec.decode(input, { schema: 'user' });

            // post-parse injection retains the server condition as a
            // conjunct alongside every client condition.
            const scoped = new Query({
                ...query,
                filters: query!.filters.and(eq('realm_id', 1)),
            });

            return adapter.execute(scoped).args;
        };

        const bare = applyScoped('');
        expect(selectRows(bare.where, records).map((record) => record.id)).toEqual([2]);

        // the client filter matches caleb, who is outside the scope
        const filtered = applyScoped('filter[first_name]=Caleb');
        expect(selectRows(filtered.where, records)).toHaveLength(0);
    });

    it('should keep an application-owned predicate alongside client filters', () => {
        const { args } = repository.findMany(
            'filter[first_name]=Caleb',
            { where: { realm_id: 1 } },
        );

        expect(args.where).toEqual({
            AND: [
                { realm_id: 1 },
                { first_name: { equals: 'Caleb', mode: 'insensitive' } },
            ],
        });

        expect(selectRows(args.where, records)).toHaveLength(0);
    });

    it('should reject all client parameters on a strict repository', () => {
        const strict = createUserRepository(defineSchema<User>({
            name: 'user',
            strict: true,
            pagination: { maxLimit: 50 },
        }));

        const { args, pagination } = strict.findMany(
            'fields=email&filter[first_name]=Caleb&include=realm&sort=-age&page[limit]=100',
        );

        expect(pagination).toEqual({ limit: 50, offset: 0 });

        expect(args.where).toBeUndefined();
        expect(args.select).toBeUndefined();
        expect(args.include).toBeUndefined();
        expect(args.orderBy).toBeUndefined();
        expect(args.take).toEqual(50);
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    Pagination,
    Query,
    Sort,
    SortDirection,
    Sorts,
    gte,
} from '@rapiq/core';
import { PrismaAdapter, defineMetadata, mergeArgs } from '../../src';
import { datamodel } from '../data/datamodel';

/**
 * A recording delegate: answers like a prisma model and captures the
 * argument objects it was called with.
 */
function createRecordingClient() {
    const models : Record<string, any> = {};
    for (const model of datamodel.models) {
        models[model.name] = { fields: model.fields };
    }

    const calls : { findMany: any[], count: any[] } = { findMany: [], count: [] };

    const client : Record<string, any> = {
        _runtimeDataModel: { models },
        _activeProvider: 'postgresql',
    };

    client.user = {
        $name: 'User',
        $parent: client,
        fields: { id: { modelName: 'User', name: 'id' } },
        findMany: (args: any) => {
            calls.findMany.push(args);
            return Promise.resolve([{ id: 1 }]);
        },
        count: (args: any) => {
            calls.count.push(args);
            return Promise.resolve(7);
        },
    };

    return { client, calls };
}

const query = new Query({
    filters: new Filters(FilterCompoundOperator.AND, [gte('age', 18)]),
    sorts: new Sorts([new Sort('age', SortDirection.DESC)]),
    pagination: new Pagination(10, 20),
});

describe('src/adapter/module.ts (runners)', () => {
    it('should run findMany with the serialized arguments', async () => {
        const { client, calls } = createRecordingClient();

        const rows = await new PrismaAdapter({ model: client.user }).findMany(query);

        expect(rows).toEqual([{ id: 1 }]);
        expect(calls.findMany).toEqual([{
            where: { age: { gte: 18 } },
            orderBy: [{ age: 'desc' }],
            take: 10,
            skip: 20,
        }]);
    });

    it('should count without pagination or selection', async () => {
        const { client, calls } = createRecordingClient();

        const total = await new PrismaAdapter({ model: client.user }).count(query);

        expect(total).toEqual(7);
        expect(calls.count).toEqual([{ where: { age: { gte: 18 } } }]);
    });

    it('should conjoin a baseline where into every runner', async () => {
        const { client, calls } = createRecordingClient();
        const adapter = new PrismaAdapter({ model: client.user });

        await adapter.findMany(query, { base: { where: { realm_id: 1 } } });
        await adapter.count(query, { base: { where: { realm_id: 1 } } });

        expect(calls.findMany[0].where).toEqual({ AND: [{ realm_id: 1 }, { age: { gte: 18 } }] });
        expect(calls.count[0].where).toEqual({ AND: [{ realm_id: 1 }, { age: { gte: 18 } }] });
    });

    it('should resolve the delegate from a client and a model name', async () => {
        const { client, calls } = createRecordingClient();

        await new PrismaAdapter({ client, model: 'User' }).findMany(query);

        expect(calls.findMany).toHaveLength(1);
    });

    it('should reject typed on an unbound adapter', async () => {
        const adapter = new PrismaAdapter({
            provider: 'postgresql',
            metadata: defineMetadata(datamodel, 'User'),
        });

        // rejections, never synchronous throws: every runner returns a
        // promise, so a .catch() must observe the failure.
        await expect(adapter.findMany(query)).rejects.toMatchObject({
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
        await expect(adapter.count(query)).rejects.toMatchObject({
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    });

    it('should reject typed for a model object that cannot run', async () => {
        const { client } = createRecordingClient();

        // metadata and provider resolve through the backref, but an
        // object without findMany is not a runnable binding.
        const adapter = new PrismaAdapter({
            model: {
                $name: 'User',
                $parent: client,
                fields: { id: { modelName: 'User', name: 'id' } },
            },
        });

        expect(adapter.execute(query).args.where).toBeDefined();
        await expect(adapter.findMany(query)).rejects.toMatchObject({
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    });
});

describe('src/adapter/merge.ts', () => {
    it('should conjoin where conditions', () => {
        expect(mergeArgs(
            { where: { realm_id: 1 } },
            { where: { age: { gte: 18 } } },
        )).toEqual({ where: { AND: [{ realm_id: 1 }, { age: { gte: 18 } }] } });
    });

    it('should keep a one-sided where as it is', () => {
        expect(mergeArgs({ where: { realm_id: 1 } }, {})).toEqual({ where: { realm_id: 1 } });
        expect(mergeArgs({}, { where: { realm_id: 1 } })).toEqual({ where: { realm_id: 1 } });
    });

    it('should replace the selection with an overriding select', () => {
        expect(mergeArgs(
            { include: { realm: true } },
            { select: { id: true } },
        )).toEqual({ select: { id: true } });
    });

    it('should join an overriding include into a baseline select', () => {
        // widening a caller-owned projection would expose columns the
        // application chose to withhold.
        expect(mergeArgs(
            { select: { id: true, first_name: true } },
            { include: { realm: true } },
        )).toEqual({
            select: {
                id: true, 
                first_name: true, 
                realm: true, 
            }, 
        });
    });

    it('should set an include when no baseline select restricts', () => {
        expect(mergeArgs({}, { include: { realm: true } })).toEqual({ include: { realm: true } });
    });

    it('should let pagination and order overrides win', () => {
        expect(mergeArgs(
            { take: 5, orderBy: [{ id: 'asc' }] },
            {
                take: 10, 
                skip: 2, 
                orderBy: [{ age: 'desc' }], 
            },
        )).toEqual({
            take: 10,
            skip: 2,
            orderBy: [{ age: 'desc' }],
        });
    });

    it('should pass unknown keys through', () => {
        expect(mergeArgs(
            { cursor: { id: 5 }, distinct: ['email'] } as any,
            { where: { age: { gte: 18 } } },
        )).toEqual({
            cursor: { id: 5 },
            distinct: ['email'],
            where: { age: { gte: 18 } },
        });
    });
});

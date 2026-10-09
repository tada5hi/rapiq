/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createURLCodec } from '@rapiq/codec-url';
import type { FindManyConfig } from '../../src';
import { DrizzleAdapter } from '../../src';
import { createAdapterOptions, createRegistry } from '../data';
import { records } from '../data/records';
import { createEngine } from '../data/engine';

/**
 * M2 gate archetype, ported to the config-object adapter: a
 * repository takes raw client input, validates it against a schema
 * and hands the result to drizzle.
 */
function createUserRepository(provider = 'pg') {
    const codec = createURLCodec(createRegistry());
    const adapter = new DrizzleAdapter(createAdapterOptions({ provider }));

    return {
        findMany(input: string | Record<string, any>, base?: FindManyConfig) {
            const query = codec.decode(input, { schema: 'user' });
            expect(query).toBeDefined();

            return adapter.execute(query!, { base });
        },
    };
}

describe('acceptance: request query to drizzle config', () => {
    const repository = createUserRepository();

    it('should map a full client request', () => {
        const { config, pagination } = repository.findMany(
            'fields=%2Bemail&filter[realm_id]=1,null&include=realm&sort=-age&page[limit]=100',
        );

        // the requested limit is clamped to maxLimit and echoed back
        expect(pagination).toEqual({ limit: 50, offset: 0 });

        expect(config.limit).toEqual(50);
        expect(config.offset).toEqual(0);
        expect(config.orderBy).toEqual({ age: 'desc' });

        // null-aware membership: records of the realm *or* without one
        expect(config.where).toEqual({
            OR: [
                { realm_id: { in: [1] } },
                { realm_id: { isNull: true } },
            ],
        });

        // the sensitive field is projected only because the client
        // opted in; the hydrated relation is narrowed to the realm
        // schema's allow-listed fieldset (#847).
        expect(config.columns).toEqual({
            id: true,
            first_name: true,
            last_name: true,
            age: true,
            email: true,
        });
        expect(config.with).toEqual({
            realm: {
                columns: {
                    id: true,
                    name: true,
                    description: true,
                },
            },
        });
    });

    it('should hide undeclared parameters', () => {
        const { config, pagination } = repository.findMany({
            filter: { age: '18' },
            sort: '-email',
        });

        expect(pagination).toEqual({ limit: 50, offset: 0 });

        // age is filterable, email is not sortable
        expect(config.where).toEqual({ age: { eq: 18 } });
        expect(config.orderBy).toBeUndefined();

        expect(config.columns).toEqual({
            id: true,
            first_name: true,
            last_name: true,
            age: true,
        });
    });

    it('should preserve a caller-owned scope through the pipeline', () => {
        const { config } = repository.findMany('filter[age]=18', { where: { realm_id: 1 } });

        expect(config.where).toEqual({
            AND: [
                { realm_id: 1 },
                { age: { eq: 18 } },
            ],
        });
    });

    it('should execute a decoded request against the engine', async () => {
        const repo = createUserRepository('sqlite');

        const { config } = repo.findMany('filter[age]=>=30&sort=-age&include=realm');

        const rows = await createEngine(records).query.users.findMany(config);

        expect(rows.map((row) => row.id)).toEqual([2, 3]);
        expect(rows[0]).toEqual({
            id: 2,
            first_name: 'Aston',
            last_name: 'Nel',
            age: 60,
            realm: null,
        });
    });
});

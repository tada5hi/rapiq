/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    FilterCompoundOperator,
    Filters,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    inArray,
} from '@rapiq/core';
import { applyQuery } from '@rapiq/adapter-memory';
import { DrizzleAdapter } from '../../src';
import { createAdapterOptions } from '../data';
import { records } from '../data/records';
import { createEngine } from '../data/engine';

/**
 * The emitted selection, ordering and pagination shapes executed by
 * the real engine: what a consumer actually receives.
 */
describe('engine: selection and ordering', () => {
    const adapter = new DrizzleAdapter(createAdapterOptions({ provider: 'sqlite' }));

    const run = (query: Query) => {
        const { config } = adapter.execute(query);

        return createEngine(records).query.users.findMany(config);
    };

    it('should hydrate an included relation whole', async () => {
        const rows = await run(new Query({
            fields: new Fields([new Field('id')]),
            relations: new Relations([new Relation('realm')]),
        }));

        expect(rows[0]).toEqual({
            id: 1,
            realm: {
                id: 1,
                name: 'master',
                description: null,
            },
        });
        expect(rows[1]).toEqual({ id: 2, realm: null });
    });

    it('should narrow an included relation to its fieldset (#847)', async () => {
        const rows = await run(new Query({
            fields: new Fields([new Field('id'), new Field('items.title')]),
            relations: new Relations([new Relation('items')]),
        }));

        expect(rows[0]).toEqual({ id: 1, items: [{ title: 'book' }] });
        expect(rows[1]).toEqual({ id: 2, items: [] });
    });

    it('should narrow the root to no scalars when only relation columns are picked', async () => {
        const rows = await run(new Query({
            fields: new Fields([new Field('realm.name')]),
            relations: new Relations([new Relation('realm')]),
        }));

        expect(rows[0]).toEqual({ realm: { name: 'master' } });
    });

    it('should keep the sort priority of a multi-key orderBy', async () => {
        const rows = await run(new Query({
            fields: new Fields([new Field('id')]),
            sorts: new Sorts([
                new Sort('age', SortDirection.DESC),
                new Sort('id', SortDirection.DESC),
            ]),
        }));

        expect(rows.map((row) => row.id)).toEqual([2, 3, 1]);
    });

    it('should apply limit and offset', async () => {
        const rows = await run(new Query({
            fields: new Fields([new Field('id')]),
            sorts: new Sorts([new Sort('id')]),
            pagination: new Pagination(1, 1),
        }));

        expect(rows.map((row) => row.id)).toEqual([2]);
    });

    it('should return no rows for an unsatisfiable condition', async () => {
        const rows = await run(new Query({ filters: new Filters(FilterCompoundOperator.AND, [inArray('id', [])]) }));

        expect(rows).toEqual([]);
    });

    it('should agree with the memory adapter on an explicit limit of 0', async () => {
        // limit: 0 is a value, not absence, across the whole fleet;
        // the impossible-root encoding depends on this reading.
        const query = new Query({
            fields: new Fields([new Field('id')]),
            pagination: new Pagination(0),
        });

        const rows = await run(query);
        const { data } = applyQuery(query, records);

        expect(rows).toEqual([]);
        expect(rows).toEqual(data);
    });
});

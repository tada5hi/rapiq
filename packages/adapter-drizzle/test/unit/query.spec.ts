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
    eq,
    inArray,
} from '@rapiq/core';
import { createAdapterOptions } from '../data';
import { DrizzleAdapter, buildDrizzleConfig } from '../../src';

describe('src/adapter/module.ts', () => {
    it('should compose the whole config object', () => {
        const query = new Query({
            fields: new Fields([new Field('id'), new Field('first_name')]),
            filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]),
            pagination: new Pagination(10, 20),
            sorts: new Sorts([
                new Sort('age', SortDirection.DESC),
                new Sort('first_name'),
            ]),
        });

        const { config, pagination } = new DrizzleAdapter(createAdapterOptions()).execute(query);

        expect(config).toEqual({
            columns: { id: true, first_name: true },
            where: { age: { eq: 18 } },
            orderBy: { age: 'desc', first_name: 'asc' },
            limit: 10,
            offset: 20,
        });

        expect(pagination).toEqual({ limit: 10, offset: 20 });
    });

    it('should emit no keys for an empty query', () => {
        const { config, pagination } = new DrizzleAdapter(createAdapterOptions()).execute(new Query());

        expect(config).toEqual({});
        expect(pagination).toEqual({ limit: undefined, offset: undefined });
    });

    it('should express an unsatisfiable condition through limit 0', () => {
        // the filter object has no dialect-free false literal: an
        // empty `OR` group is stripped by drizzle (measured), so the
        // config caps the result instead.
        const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [inArray('id', [])]) });

        const { config } = new DrizzleAdapter(createAdapterOptions()).execute(query);

        expect(config).toEqual({ limit: 0 });
    });

    describe('baseline config', () => {
        it('should narrow a caller-owned predicate instead of replacing it', () => {
            const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]) });

            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(query, { base: { where: { realm_id: 1 } } });

            expect(config.where).toEqual({
                AND: [
                    { realm_id: 1 },
                    { age: { eq: 18 } },
                ],
            });
        });

        it('should keep a caller-owned predicate without query filters', () => {
            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(new Query(), { base: { where: { realm_id: 1 } } });

            expect(config.where).toEqual({ realm_id: 1 });
        });

        it('should cap an unsatisfiable condition over any baseline', () => {
            const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [inArray('id', [])]) });

            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(query, { base: { where: { realm_id: 1 }, limit: 25 } });

            expect(config.where).toEqual({ realm_id: 1 });
            expect(config.limit).toEqual(0);
        });

        it('should preserve unrelated baseline keys', () => {
            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(new Query(), { base: { limit: 5, orderBy: { id: 'asc' } } });

            expect(config).toEqual({ limit: 5, orderBy: { id: 'asc' } });
        });

        it('should replace a baseline projection with the produced one', () => {
            const query = new Query({ fields: new Fields([new Field('id')]) });

            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(query, { base: { columns: { email: true } } });

            expect(config).toEqual({ columns: { id: true } });
        });

        it('should join produced relations into a baseline `with`', () => {
            const query = new Query({ relations: new Relations([new Relation('realm')]) });

            const { config } = new DrizzleAdapter(createAdapterOptions()).execute(query, { base: { with: { items: true }, columns: { id: true } } });

            expect(config).toEqual({
                columns: { id: true },
                with: { items: true, realm: true },
            });
        });
    });

    it('should hold no state between runs', () => {
        const adapter = new DrizzleAdapter(createAdapterOptions());

        adapter.execute(new Query({
            filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]),
            sorts: new Sorts([new Sort('age', SortDirection.DESC)]),
        }));

        const { config } = adapter.execute(new Query());

        expect(config).toEqual({});
    });

    it('should not carry per-call filter options into the next run', () => {
        const adapter = new DrizzleAdapter(createAdapterOptions());
        const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('first_name', 'Peter')]) });

        adapter.execute(query, { caseSensitive: true });

        expect(adapter.execute(query).config.where).toEqual({ first_name: { ilike: 'Peter' } });
    });

    it('should expose a one-shot helper', () => {
        const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]) });

        expect(buildDrizzleConfig(query, createAdapterOptions()).config).toEqual({ where: { age: { eq: 18 } } });
    });
});

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
import { createAdapterOptions } from '../data/schema';
import { PrismaAdapter, buildPrismaArgs } from '../../src';

describe('src/adapter/module.ts', () => {
    it('should compose the whole argument object', () => {
        const query = new Query({
            fields: new Fields([new Field('id'), new Field('first_name')]),
            filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]),
            pagination: new Pagination(10, 20),
            sorts: new Sorts([
                new Sort('age', SortDirection.DESC),
                new Sort('first_name'),
            ]),
        });

        const { args, pagination } = new PrismaAdapter(createAdapterOptions()).execute(query);

        expect(args).toEqual({
            select: { id: true, first_name: true },
            where: { age: { equals: 18 } },
            orderBy: [{ age: 'desc' }, { first_name: 'asc' }],
            take: 10,
            skip: 20,
        });

        expect(pagination).toEqual({ limit: 10, offset: 20 });
    });

    it('should emit no keys for an empty query', () => {
        const { args, pagination } = new PrismaAdapter(createAdapterOptions()).execute(new Query());

        expect(args).toEqual({});
        expect(pagination).toEqual({ limit: undefined, offset: undefined });
    });

    describe('baseline arguments', () => {
        it('should narrow a caller-owned predicate instead of replacing it', () => {
            const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]) });

            const { args } = new PrismaAdapter(createAdapterOptions()).execute(query, { base: { where: { realm_id: 1 } } });

            expect(args.where).toEqual({
                AND: [
                    { realm_id: 1 },
                    { age: { equals: 18 } },
                ],
            });
        });

        it('should keep a caller-owned predicate without query filters', () => {
            const { args } = new PrismaAdapter(createAdapterOptions()).execute(new Query(), { base: { where: { realm_id: 1 } } });

            expect(args.where).toEqual({ realm_id: 1 });
        });

        it('should keep the baseline alongside an unsatisfiable condition', () => {
            // `{ OR: [] }` is prisma's `1 = 0`: valid at the root only,
            // where sibling operator keys are conjoined.
            const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [inArray('id', [])]) });

            const { args } = new PrismaAdapter(createAdapterOptions()).execute(query, { base: { where: { realm_id: 1 } } });

            expect(args.where).toEqual({
                OR: [],
                AND: [{ realm_id: 1 }],
            });
        });

        it('should preserve unrelated baseline keys', () => {
            const { args } = new PrismaAdapter(createAdapterOptions()).execute(new Query(), { base: { take: 5, orderBy: [{ id: 'asc' }] } });

            expect(args).toEqual({ take: 5, orderBy: [{ id: 'asc' }] });
        });

        it('should replace a baseline selection to keep select and include exclusive', () => {
            const query = new Query({ fields: new Fields([new Field('id')]) });

            const { args } = new PrismaAdapter(createAdapterOptions()).execute(query, { base: { include: { realm: true } } });

            expect(args).toEqual({ select: { id: true } });
        });

        it('should never widen a caller-owned projection', () => {
            // relations join the baseline's select instead of replacing
            // it: dropping it would expose every column of the model.
            const query = new Query({ relations: new Relations([new Relation('realm')]) });

            const { args } = new PrismaAdapter(createAdapterOptions()).execute(query, { base: { select: { id: true, first_name: true } } });

            expect(args).toEqual({
                select: {
                    id: true, 
                    first_name: true, 
                    realm: true, 
                }, 
            });
        });

        it('should drop a baseline omit next to a produced select', () => {
            const query = new Query({ fields: new Fields([new Field('id')]) });

            const { args } = new PrismaAdapter(createAdapterOptions()).execute(query, { base: { omit: { email: true } } as any });

            expect(args).toEqual({ select: { id: true } });
        });
    });

    it('should hold no state between runs', () => {
        const adapter = new PrismaAdapter(createAdapterOptions());

        adapter.execute(new Query({
            filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]),
            sorts: new Sorts([new Sort('age', SortDirection.DESC)]),
        }));

        const { args } = adapter.execute(new Query());

        expect(args).toEqual({});
    });

    it('should not carry per-call filter options into the next run', () => {
        const adapter = new PrismaAdapter(createAdapterOptions());
        const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('first_name', 'Peter')]) });

        adapter.execute(query, { caseSensitive: true });

        expect(adapter.execute(query).args.where).toEqual({ first_name: { equals: 'Peter', mode: 'insensitive' } });
    });

    it('should expose a one-shot helper', () => {
        const query = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('age', 18)]) });

        expect(buildPrismaArgs(query, createAdapterOptions()).args).toEqual({ where: { age: { equals: 18 } } });
    });
});

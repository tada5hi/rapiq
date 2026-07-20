/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    Sorts,
    defineQuery,
    isField,
    isFields,
    isFilter,
    isFilters,
    isPagination,
    isParameterNode,
    isQuery,
    isRelation,
    isRelations,
    isSort,
    isSorts,
} from '../../../src';

const guards = {
    query: isQuery,
    fields: isFields,
    field: isField,
    filters: isFilters,
    filter: isFilter,
    pagination: isPagination,
    relations: isRelations,
    relation: isRelation,
    sorts: isSorts,
    sort: isSort,
} as const;

const nodes = {
    query: new Query(),
    fields: new Fields([new Field('id')]),
    field: new Field('id'),
    filters: new Filters(FilterCompoundOperator.AND, [
        new Filter(FilterFieldOperator.EQUAL, 'id', 1),
    ]),
    filter: new Filter(FilterFieldOperator.EQUAL, 'id', 1),
    pagination: new Pagination(10, 0),
    relations: new Relations([new Relation('realm')]),
    relation: new Relation('realm'),
    sorts: new Sorts([new Sort('name', 'DESC')]),
    sort: new Sort('name', 'DESC'),
} as const;

type NodeKey = keyof typeof nodes;

describe('src/parameter/**/check.ts', () => {
    describe('cross-family discrimination', () => {
        const guardKeys = Object.keys(guards) as NodeKey[];
        const nodeKeys = Object.keys(nodes) as NodeKey[];

        for (const guardKey of guardKeys) {
            for (const nodeKey of nodeKeys) {
                const expected = guardKey === nodeKey;

                it(`is${expected ? '' : ' not'}: ${guardKey} guard x ${nodeKey} node`, () => {
                    expect(guards[guardKey](nodes[nodeKey] as any)).toBe(expected);
                });
            }
        }
    });

    describe('empty collections', () => {
        it('should distinguish structurally identical empty collections', () => {
            expect(isFields(new Fields())).toBe(true);
            expect(isSorts(new Fields())).toBe(false);
            expect(isRelations(new Fields())).toBe(false);

            expect(isSorts(new Sorts())).toBe(true);
            expect(isFields(new Sorts())).toBe(false);
            expect(isRelations(new Sorts())).toBe(false);

            expect(isRelations(new Relations())).toBe(true);
            expect(isFields(new Relations())).toBe(false);
            expect(isSorts(new Relations())).toBe(false);
        });

        it('should recognize a pagination node without limit & offset', () => {
            expect(isPagination(new Pagination())).toBe(true);
        });
    });

    describe('defineQuery output', () => {
        const query = defineQuery({
            fields: ['id', 'name'],
            filters: { name: 'John' },
            pagination: { limit: 10, offset: 0 },
            relations: ['realm'],
            sort: ['-name'],
        });

        it('should recognize the query node', () => {
            expect(isQuery(query)).toBe(true);
        });

        it('should recognize the parameter nodes', () => {
            expect(isFields(query.fields)).toBe(true);
            expect(isFilters(query.filters)).toBe(true);
            expect(isPagination(query.pagination)).toBe(true);
            expect(isRelations(query.relations)).toBe(true);
            expect(isSorts(query.sorts)).toBe(true);
        });

        it('should not confuse parameter nodes across families', () => {
            expect(isSorts(query.fields)).toBe(false);
            expect(isFields(query.sorts)).toBe(false);
            expect(isQuery(query.filters)).toBe(false);
            expect(isPagination(query)).toBe(false);
        });
    });

    describe('build input & non-node values', () => {
        it('should not recognize build input shapes', () => {
            expect(isQuery({ fields: ['id'], filters: { name: 'John' } })).toBe(false);
            expect(isFields(['id', 'name'])).toBe(false);
            expect(isSorts(['-name'])).toBe(false);
            expect(isSorts({ name: 'DESC' })).toBe(false);
            expect(isRelations(['realm'])).toBe(false);
            expect(isPagination({ limit: 10, offset: 0 })).toBe(false);
            expect(isField({ name: 'id' })).toBe(false);
            expect(isSort({ name: 'name', operator: 'desc' })).toBe(false);
            expect(isRelation({ name: 'realm' })).toBe(false);
        });

        it('should not recognize primitives & empty values', () => {
            expect(isQuery(null)).toBe(false);
            expect(isQuery(undefined)).toBe(false);
            expect(isQuery('query')).toBe(false);
            expect(isSorts(1)).toBe(false);
            expect(isFields({})).toBe(false);
        });

        it('should not recognize objects with a non-dispatching accept', () => {
            const fake = { accept: () => true };

            expect(isQuery(fake)).toBe(false);
            expect(isFields(fake)).toBe(false);
            expect(isSorts(fake)).toBe(false);
            expect(isRelations(fake)).toBe(false);
            expect(isPagination(fake)).toBe(false);
        });
    });

    describe('cross package instances', () => {
        it('should recognize a foreign node by its dispatch', () => {
            // simulates a node built by another copy of @rapiq/core:
            // same duck-typed shape, different class identity.
            const foreign = {
                value: [],
                accept: (visitor: { visitSorts: (input: unknown) => unknown }) => (
                    visitor.visitSorts(foreign)
                ),
                merge: () => foreign,
            };

            expect(isSorts(foreign)).toBe(true);
            expect(isFields(foreign)).toBe(false);
        });
    });

    describe('isParameterNode', () => {
        it('should recognize every AST node', () => {
            const keys = Object.keys(nodes) as NodeKey[];
            for (const key of keys) {
                expect(isParameterNode(nodes[key])).toBe(true);
            }
        });

        it('should not recognize plain input', () => {
            expect(isParameterNode(null)).toBe(false);
            expect(isParameterNode({})).toBe(false);
            expect(isParameterNode({ accept: 'yes' })).toBe(false);
            expect(isParameterNode(['id'])).toBe(false);
        });
    });
});

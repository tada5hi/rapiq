/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    defineFiltersSchema,
    defineSortSchema,
    isRelationRejected,
    pruneFieldsByRelations,
    pruneFiltersByRelations,
    pruneRelationsByRelations,
    pruneSortsByRelations,
} from '../../../src';
import type { IFilters } from '../../../src';

function filterFields(input: IFilters) : string[] {
    const output : string[] = [];
    const walk = (node: any) => {
        for (const child of node.value) {
            if (Array.isArray(child.value)) {
                walk(child);
            } else {
                output.push(child.field as string);
            }
        }
    };
    walk(input);

    return output;
}

describe('src/parser/relation-prune.ts', () => {
    describe('isRelationRejected', () => {
        it('matches the relation itself and its descendants, not a shared name prefix', () => {
            expect(isRelationRejected('user', ['user'])).toBe(true);
            expect(isRelationRejected('user.name', ['user'])).toBe(true);
            expect(isRelationRejected('user.profile.id', ['user'])).toBe(true);
            expect(isRelationRejected('username', ['user'])).toBe(false);
            expect(isRelationRejected('realm', ['user'])).toBe(false);
            expect(isRelationRejected('user', [])).toBe(false);
        });
    });

    describe('pruneFieldsByRelations', () => {
        it('returns the input unchanged when nothing is rejected', () => {
            const fields = new Fields([new Field('id')]);
            expect(pruneFieldsByRelations(fields, [])).toBe(fields);
        });

        it('drops fields that traverse a rejected relation', () => {
            const fields = new Fields([
                new Field('id'),
                new Field('user.email'),
                new Field('realm.name'),
            ]);

            const output = pruneFieldsByRelations(fields, ['user']);
            expect(output.value.map((f) => f.name)).toEqual(['id', 'realm.name']);
        });
    });

    describe('pruneSortsByRelations', () => {
        it('drops sorts that traverse a rejected relation', () => {
            const sorts = new Sorts([
                new Sort('id', SortDirection.ASC),
                new Sort('user.name', SortDirection.DESC),
            ]);

            const output = pruneSortsByRelations(sorts, ['user']);
            expect(output.value.map((s) => s.name)).toEqual(['id']);
        });

        it('re-applies the schema default when pruning empties the sort', () => {
            const sorts = new Sorts([new Sort('user.name', SortDirection.DESC)]);
            const schema = defineSortSchema({ default: { name: 'DESC' } });

            const output = pruneSortsByRelations(sorts, ['user'], schema);
            expect(output.value.map((s) => s.name)).toEqual(['name']);
        });

        it('leaves an emptied sort empty without a schema', () => {
            const sorts = new Sorts([new Sort('user.name', SortDirection.DESC)]);
            expect(pruneSortsByRelations(sorts, ['user']).value).toEqual([]);
        });

        it('re-applies a dotted default key', () => {
            const sorts = new Sorts([new Sort('user.name', SortDirection.DESC)]);
            const schema = defineSortSchema({ default: { 'realm.name': 'ASC' } });

            const output = pruneSortsByRelations(sorts, ['user'], schema);
            expect(output.value.map((s) => s.name)).toEqual(['realm.name']);
        });
    });

    describe('pruneRelationsByRelations', () => {
        it('drops a rejected relation and every relation beneath it', () => {
            const relations = new Relations([
                new Relation('realm'),
                new Relation('user'),
                new Relation('user.profile'),
            ]);

            const output = pruneRelationsByRelations(relations, ['user']);
            expect(output.value.map((r) => r.name)).toEqual(['realm']);
        });
    });

    describe('pruneFiltersByRelations', () => {
        const eq = (field: string) => new Filter(FilterFieldOperator.EQUAL, field, 'x');

        it('returns the input unchanged when nothing is rejected', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [eq('id')]);
            expect(pruneFiltersByRelations(filters, [])).toBe(filters);
        });

        it('drops leaves that traverse a rejected relation', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                eq('id'),
                eq('user.name'),
            ]);

            expect(filterFields(pruneFiltersByRelations(filters, ['user']))).toEqual(['id']);
        });

        it('prunes inside nested compounds and drops empty ones', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.OR, [eq('user.a'), eq('id')]),
                new Filters(FilterCompoundOperator.OR, [eq('user.b')]),
            ]);

            const output = pruneFiltersByRelations(filters, ['user']);
            expect(filterFields(output)).toEqual(['id']);
        });

        it('falls back to the schema default when pruning empties the tree', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [eq('user.a')]);
            const schema = defineFiltersSchema({ default: eq('id') });

            expect(filterFields(pruneFiltersByRelations(filters, ['user'], schema))).toEqual(['id']);
        });

        it('drops an elemMatch whose target relation is rejected', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                ),
            ]);

            expect(pruneFiltersByRelations(filters, ['items']).value).toEqual([]);
        });

        it('prunes an elemMatch interior by its absolute (prefixed) path', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [
                        eq('owner.name'),
                        new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    ]),
                ),
            ]);

            // reject items.owner: the interior owner.name (absolute items.owner.name)
            // drops, the surviving interior keeps the elemMatch on items.
            const output = pruneFiltersByRelations(filters, ['items.owner']);
            const [elem] = output.value as [Filter];
            expect(elem.operator).toBe(FilterFieldOperator.ELEM_MATCH);
            expect(filterFields(elem.value as IFilters)).toEqual(['id']);
        });

        it('drops an elemMatch whose interior empties out', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [eq('owner.name')]),
                ),
            ]);

            expect(pruneFiltersByRelations(filters, ['items.owner']).value).toEqual([]);
        });
    });
});

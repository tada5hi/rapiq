/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Condition,
    ErrorCode,
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
    preserve,
    pruneFieldsByRelations,
    pruneFiltersByRelations,
    pruneRelationsByRelations,
    pruneSortsByRelations,
} from '../../../src';
import type { IFilters } from '../../../src';

class CustomCondition extends Condition<{ scope: string }> {
    constructor(value: { scope: string }) {
        super('custom', value);
    }
}

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

    describe('pruneFiltersByRelations (preserved conditions)', () => {
        const eq = (field: string) => new Filter(FilterFieldOperator.EQUAL, field, 'x');

        it('throws instead of dropping a preserved leaf', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(eq('user.name')),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['user']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('names the rejected relation and the preserved field', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(eq('realm.id')),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['realm']))
                .toThrowError(/"realm".+"realm\.id"/);
        });

        it('throws instead of dropping a policy residual out of a preserved group', () => {
            // the shape a filters validate hook produces:
            // preserve(and(<client leaf>, <policy residual>))
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(new Filters(FilterCompoundOperator.AND, [
                    eq('name'),
                    eq('realm.id'),
                ])),
                eq('realm.name'),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['realm']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws for a preserved condition nested below an unpreserved group', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.OR, [
                    eq('id'),
                    preserve(eq('user.name')),
                ]),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['user']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws instead of dropping a preserved elemMatch', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                )),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['items']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws instead of dropping an elemMatch with a preserved built-in descendant', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [preserve(eq('id'))]),
                ),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['items']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws instead of dropping an elemMatch with a preserved custom-condition wrapper', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [
                        preserve(new CustomCondition({ scope: 'tenant-a' })),
                    ]),
                ),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['items']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws instead of dropping any leaf holding a preserved interior', () => {
            // the drop takes the whole subtree with it, so the refusal cannot
            // depend on which operator happens to address an interior.
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filter('customOp', 'items', preserve(eq('id'))),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['items']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws instead of pruning the interior of a preserved elemMatch', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [
                        eq('owner.name'),
                        new Filter(FilterFieldOperator.EQUAL, 'id', 1),
                    ]),
                )),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['items.owner']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        // The two shapes below cannot fail open: dropping an OR arm narrows,
        // and dropping the interior of a NOT removes a restriction that
        // preserve() put there. Pruning still refuses, because preservation is
        // a per-node marker and not a per-operator judgement call.
        it('throws for a preserved OR arm, where a drop would narrow rather than widen', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(new Filters(FilterCompoundOperator.OR, [eq('id'), eq('user.name')])),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['user']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws for a preserved condition below a NOT', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                new Filters(FilterCompoundOperator.NOT, [preserve(eq('user.name'))]),
            ]);

            expect(() => pruneFiltersByRelations(filters, ['user']))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('keeps pruning around a preserved condition it does not touch', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [
                preserve(eq('realm_id')),
                eq('user.name'),
                eq('id'),
            ]);

            const output = pruneFiltersByRelations(filters, ['user']);
            expect(filterFields(output)).toEqual(['realm_id', 'id']);
            expect(output.value[0].preserved).toBe(true);
        });

        it('preserves rebuilt groups and elemMatch leaves', () => {
            const group = preserve(new Filters(FilterCompoundOperator.AND, [eq('realm_id')]));
            const elemMatch = preserve(new Filter(
                FilterFieldOperator.ELEM_MATCH,
                'items',
                new Filters(FilterCompoundOperator.AND, [eq('id')]),
            ));
            const filters = new Filters(FilterCompoundOperator.AND, [
                group,
                elemMatch,
                eq('user.name'),
            ]);

            const output = pruneFiltersByRelations(filters, ['user']);
            expect(output.value[0].preserved).toBe(true);
            expect(output.value[1].preserved).toBe(true);
        });

        it('re-applies an unpreserved default naming a rejected relation', () => {
            // the server-authored baseline is exempt from the gate, which is
            // why the default fallback is not pruned.
            const filters = new Filters(FilterCompoundOperator.AND, [eq('user.a')]);
            const schema = defineFiltersSchema({ default: eq('user.b') });

            expect(filterFields(pruneFiltersByRelations(filters, ['user'], schema))).toEqual(['user.b']);
        });

        it('throws for a preserved default naming a rejected relation', () => {
            // otherwise the same default would throw when it is materialized
            // before this pass (client sent no filters) and survive when it is
            // materialized after it (client sent filters that all pruned away).
            const filters = new Filters(FilterCompoundOperator.AND, [eq('user.a')]);
            const schema = defineFiltersSchema({ default: preserve(eq('user.b')) });

            expect(() => pruneFiltersByRelations(filters, ['user'], schema))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });

        it('throws for a default elemMatch with a preserved descendant after input pruning empties', () => {
            const filters = new Filters(FilterCompoundOperator.AND, [eq('items.name')]);
            const schema = defineFiltersSchema({
                default: new Filter(
                    FilterFieldOperator.ELEM_MATCH,
                    'items',
                    new Filters(FilterCompoundOperator.AND, [preserve(eq('id'))]),
                ),
            });

            expect(() => pruneFiltersByRelations(filters, ['items'], schema))
                .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
        });
    });
});

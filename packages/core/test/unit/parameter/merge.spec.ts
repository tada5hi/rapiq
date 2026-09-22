/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IFilter,
    IFilters,
    IQuery,
} from '../../../src';
import {
    Aggregate,
    Aggregates,
    Condition,
    ErrorCode,
    Field,
    Fields,
    FilterCompoundOperator,
    Filters,
    Group,
    Groups,
    MergeError,
    Pagination,
    Query,
    Relations,
    Sorts,
    and,
    contains,
    defineQuery,
    eq,
    gte,
    isFilter,
    isFilters,
    mergeQueries,
    or,
    preserve,
    pruneFiltersByRelations,
} from '../../../src';
import type { User } from '../../data';

const conditions = (filters: { value: unknown[] }) => (filters.value as IFilter[])
    .map((el) => [el.field, el.operator, el.value]);

class CustomCondition extends Condition<{ scope: string }> {
    constructor(value: { scope: string }) {
        super('custom', value);
    }
}

describe('src/parameter/merge.ts', () => {
    it('should return an empty query without input', () => {
        const output = mergeQueries();

        expect(output.fields.value).toEqual([]);
        expect(output.filters.value).toEqual([]);
    });

    it('should merge fields, relations & sorts keyed by name with left priority', () => {
        const left = defineQuery<User>({
            fields: ['id', '-email'],
            relations: ['realm'],
            sort: '-age',
        });
        const right = defineQuery<User>({
            fields: ['+email', 'name'],
            relations: ['realm', 'items'],
            sort: ['age', 'name'],
        });

        const output = mergeQueries(left, right);

        // first occurrence wins value and position.
        expect(output.fields.value.map((el) => [el.name, el.operator])).toEqual([
            ['id', undefined],
            ['email', '-'],
            ['name', undefined],
        ]);
        expect(output.relations.value.map((el) => el.name)).toEqual(['realm', 'items']);
        expect(output.sorts.value.map((el) => [el.name, el.operator])).toEqual([
            ['age', 'DESC'],
            ['name', 'ASC'],
        ]);
    });

    it('should merge pagination per property', () => {
        const output = mergeQueries(
            defineQuery({ pagination: { limit: 10 } }),
            defineQuery({ pagination: { limit: 50, offset: 20 } }),
        );

        expect(output.pagination.limit).toBe(10);
        expect(output.pagination.offset).toBe(20);
    });

    it('should retain same-field range conditions from both queries', () => {
        const output = mergeQueries(
            defineQuery<User>({ filters: { age: { $gte: 18 } } }),
            defineQuery<User>({ filters: { age: { $lt: 65 } } }),
        );

        expect(conditions(output.filters)).toEqual([
            ['age', 'gte', 18],
            ['age', 'lt', 65],
        ]);
    });

    it('should retain contradictory same-field conditions in argument order', () => {
        const a = defineQuery<User>({ filters: { name: 'a' } });
        const b = defineQuery<User>({ filters: { name: 'b' } });

        expect(conditions(mergeQueries(a, b).filters)).toEqual([
            ['name', 'eq', 'a'],
            ['name', 'eq', 'b'],
        ]);
        expect(conditions(mergeQueries(b, a).filters)).toEqual([
            ['name', 'eq', 'b'],
            ['name', 'eq', 'a'],
        ]);
    });

    it('should not mutate its inputs', () => {
        const left = defineQuery<User>({ filters: { name: 'John' }, fields: ['id'] });
        const right = defineQuery<User>({ filters: { age: 18 }, fields: ['name'] });

        mergeQueries(left, right);

        expect(left.filters.value).toHaveLength(1);
        expect(right.filters.value).toHaveLength(1);
        expect(left.fields.value).toHaveLength(1);
    });

    it('should pass filters through when one side is empty', () => {
        const compound = or(gte('age', 18), eq('email', null));
        const left = defineQuery();
        const right = defineQuery({ filters: compound });

        const output = mergeQueries(left, right);
        expect(output.filters).toBe(compound);
    });

    it('should and a compound filter tree in instead of guessing inside it', () => {
        const flat = defineQuery<User>({ filters: { name: 'John' } });
        const compound = or(gte('age', 18), eq('email', null));
        const nested = defineQuery<User>({ filters: compound });

        const output = mergeQueries(flat, nested);

        // the disjunction remains atomic, so its alternatives keep their
        // meaning while the group is carried through as one conjunct.
        expect(output.filters.operator).toBe(FilterCompoundOperator.AND);
        expect(output.filters.value).toHaveLength(2);
        expect((output.filters.value[0] as IFilter).field).toBe('name');
        expect(output.filters.value[1]).toBe(compound);
    });

    it('should throw a typed error when a merge would discard a field visibility gate', () => {
        const ungated = defineQuery<User>({ fields: ['email'] });
        const gated = new Query({ fields: new Fields([new Field('email', undefined, eq('realm_id', 'a'))]) });

        try {
            mergeQueries(ungated, gated);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(MergeError);
            expect((e as MergeError).code).toBe(ErrorCode.FIELDS_CONDITION_DISCARDED);
        }
    });

    it('should keep a receiver-side field visibility gate on collision', () => {
        const gated = new Query({ fields: new Fields([new Field('email', undefined, eq('realm_id', 'a'))]) });
        const ungated = defineQuery<User>({ fields: ['email', 'id'] });

        const output = mergeQueries(gated, ungated);

        expect(output.fields.value.map((el) => el.name)).toEqual(['email', 'id']);
        expect(output.fields.value[0].condition).toBeDefined();
    });
});

describe('src/parameter/filters/collection/module.ts combinators', () => {
    it('should append the original condition via and() without mutating the receiver', () => {
        const query = defineQuery<User>({ filters: { name: 'John' } });
        const condition = eq('realm.id', 'master');

        const scoped = query.filters.and(condition);

        // receiver untouched (immutable).
        expect(query.filters.value).toHaveLength(1);

        // the receiver already carries the operator, so the group stays flat.
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(conditions(scoped)).toEqual([
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
        ]);
        expect(scoped.value[1]).toBe(condition);
        expect((scoped.value[1] as IFilter).preserved).toBeUndefined();
    });

    it('should nest a receiver that carries another operator', () => {
        const receiver = or(eq('name', 'a'), eq('name', 'b'));

        const condition = eq('realm.id', 'master');
        const scoped = receiver.and(condition);

        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(scoped.value).toHaveLength(2);
        expect(scoped.value[0]).toBe(receiver);
        expect(scoped.value[1]).toBe(condition);
    });

    it('should retain a later condition alongside an injected condition', () => {
        const parsed = defineQuery<User>({ filters: { name: 'John' } });
        const scoped = parsed.filters.and(eq('realm.id', 'master'));

        // conjunction keeps both same-field conditions.
        const hostile = new Filters(FilterCompoundOperator.AND, [
            eq('realm.id', 'evil'),
        ]);

        expect(conditions(hostile.merge(scoped))).toEqual([
            ['realm.id', 'eq', 'evil'],
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
        ]);

        // argument order is preserved in the other direction too.
        expect(conditions(scoped.merge(hostile))).toEqual([
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
            ['realm.id', 'eq', 'evil'],
        ]);
    });

    it('should survive a normalization pass', () => {
        const scope = eq('realm.id', 'master');
        const scoped = defineQuery().filters.and(scope);
        const hostile = defineQuery<User>({ filters: { 'realm.id': 'evil' } });

        // flatten() collapses same-operator nests while retaining both leaves.
        const flat = scoped.flatten();

        expect(conditions(hostile.filters.merge(flat))).toEqual([
            ['realm.id', 'eq', 'evil'],
            ['realm.id', 'eq', 'master'],
        ]);
    });

    it('should keep an empty receiver out of the group', () => {
        const query = defineQuery();

        // an empty receiver constrains nothing; as an OR child it would
        // widen the group to everything.
        const scope = eq('realm.id', 'master');
        const scoped = query.filters.and(scope);
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(conditions(scoped)).toEqual([['realm.id', 'eq', 'master']]);
        expect(scoped.value).not.toContain(query.filters);
        expect(scoped.value[0]).toBe(scope);
        expect((scoped.value[0] as IFilter).preserved).toBeUndefined();

        const firstAlternative = eq('name', 'a');
        const secondAlternative = eq('name', 'b');
        const alternatives = query.filters.or(firstAlternative, secondAlternative);
        expect(alternatives.operator).toBe(FilterCompoundOperator.OR);
        expect(conditions(alternatives)).toEqual([
            ['name', 'eq', 'a'],
            ['name', 'eq', 'b'],
        ]);
        expect(alternatives.value).not.toContain(query.filters);
        expect(alternatives.value[0]).toBe(firstAlternative);
        expect((alternatives.value[0] as IFilter).preserved).toBeUndefined();
        expect(alternatives.value[1]).toBe(secondAlternative);
        expect((alternatives.value[1] as IFilter).preserved).toBeUndefined();
    });

    it('should retain a condition injected onto an empty receiver during merge', () => {
        const scoped = new Query({ filters: defineQuery().filters.and(eq('realm.id', 'master')) });
        const hostile = defineQuery<User>({ filters: { 'realm.id': 'evil' } });

        const output = mergeQueries(hostile, scoped);

        expect(conditions(output.filters)).toEqual([
            ['realm.id', 'eq', 'evil'],
            ['realm.id', 'eq', 'master'],
        ]);
    });

    it('should return the receiver when no conditions are injected', () => {
        const query = defineQuery<User>({ filters: { name: 'John' } });

        expect(query.filters.and()).toBe(query.filters);
        expect(query.filters.or()).toBe(query.filters);
    });

    it('should wrap an existing tree when or() adds alternatives', () => {
        const base = defineQuery<User>({ filters: { name: 'John' } });

        const output = base.filters.or(contains('email', '@example.com'));

        expect(output.operator).toBe(FilterCompoundOperator.OR);
        expect(output.value[0]).toBe(base.filters);
    });

    it('should keep both sides when merged fields differ', () => {
        const left = new Filters(FilterCompoundOperator.AND, [eq('a', 1)]);
        const right = new Filters(FilterCompoundOperator.AND, [eq('b', 2)]);

        const output = left.merge(right);

        expect(conditions(output)).toEqual([
            ['a', 'eq', 1],
            ['b', 'eq', 2],
        ]);
        // inputs stay untouched.
        expect(left.value).toHaveLength(1);
        expect(right.value).toHaveLength(1);
    });

    it('should carry a nested group of the receiver through untouched', () => {
        const group = or(eq('b', 1), eq('c', 2));
        const left = and(eq('a', 1), group);

        const output = left.merge(new Filters(FilterCompoundOperator.AND, [eq('b', 9)]));

        // no guessing inside the OR: the incoming condition is and-ed in.
        expect(output.value).toHaveLength(3);
        expect(output.value[1]).toBe(group);
        expect((output.value[2] as IFilter).field).toBe('b');
    });

    it('should preserve all leaves when merging nested and flattened root ANDs', () => {
        const nested = and(
            eq('name', 'John'),
            and(gte('age', 18), eq('active', true)),
        );
        const other = and(eq('realm.id', 'master'));

        const nestedOutput = nested.merge(other);
        const flatOutput = nested.flatten().merge(other);

        expect(conditions(nestedOutput)).toEqual(conditions(flatOutput));
        expect(conditions(nestedOutput)).toEqual([
            ['name', 'eq', 'John'],
            ['age', 'gte', 18],
            ['active', 'eq', true],
            ['realm.id', 'eq', 'master'],
        ]);
    });

    it('should treat a receiver that is not a root-AND as one conjunct', () => {
        const left = or(eq('a', 1), eq('b', 2));
        const right = new Filters(FilterCompoundOperator.AND, [eq('a', 9)]);

        const output = left.merge(right);

        // narrowing, never widening: or(a,b) AND a=9.
        expect(output.operator).toBe(FilterCompoundOperator.AND);
        expect(output.value).toHaveLength(2);
        expect(output.value[0]).toBe(left);
        expect((output.value[1] as IFilter).field).toBe('a');
    });

    it('should pass an empty side through unchanged', () => {
        const compound = or(eq('a', 1), eq('b', 2));
        const empty = new Filters(FilterCompoundOperator.AND, []);

        expect(empty.merge(compound)).toBe(compound);
        expect(compound.merge(empty)).toBe(compound);
    });
});

describe('src/parameter/filters/preserve.ts', () => {
    it('should preserve a built-in leaf immutably and idempotently', () => {
        const condition = eq('realm_id', 'master');
        const output = preserve(condition);

        expect(output).not.toBe(condition);
        expect(output.preserved).toBe(true);
        expect(preserve(output)).toBe(output);
    });

    it('should return the same kind it received rather than always wrapping', () => {
        // the catch-all overload admits every subtype, so it promises only
        // ICondition back: a leaf stays a leaf and has no group operations.
        const condition: ICondition = eq('realm_id', 'master');
        const output = preserve(condition);

        expect(isFilter(output)).toBe(true);
        expect(isFilters(output)).toBe(false);
        expect((output as unknown as IFilters).and).toBeUndefined();
    });

    it('should preserve a custom condition through a built-in wrapper', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const output = preserve(condition);

        expect(isFilters(output)).toBe(true);
        expect(output.preserved).toBe(true);
        expect(output.value).toEqual([condition]);
    });

    it('should keep a preserved root group atomic through flatten and merge', () => {
        const preservedRoot = preserve(and(eq('a', 1)));
        const other = new Filters(FilterCompoundOperator.AND, [eq('a', 9)]);

        expect(preservedRoot.flatten().preserved).toBe(true);
        expect(and(eq('b', 2), preservedRoot).flatten().value[1]).toBe(preservedRoot);

        const output = other.merge(preservedRoot);
        expect(output.value).toHaveLength(2);
        expect(output.value[1]).toBe(preservedRoot);
    });

    it('should keep a preserved AND receiver atomic when and() matches its operator', () => {
        const receiver = preserve(and(eq('realm.id', 'SCOPE')));

        const output = receiver.and(eq('name', 'John'));

        expect(output.value[0]).toBe(receiver);
        expect((output.value[0] as IFilters).preserved).toBe(true);
        expect(() => pruneFiltersByRelations(output, ['realm']))
            .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
    });

    it('should keep a preserved OR receiver atomic when or() matches its operator', () => {
        const receiver = preserve(or(eq('realm.id', 'SCOPE'), eq('id', 1)));

        const output = receiver.or(eq('name', 'John'));

        expect(output.value[0]).toBe(receiver);
        expect((output.value[0] as IFilters).preserved).toBe(true);
        expect(() => pruneFiltersByRelations(output, ['realm']))
            .toThrowError(expect.objectContaining({ code: ErrorCode.SCHEMA_PRESERVED_CONDITION_PRUNED }));
    });
});

describe('src/parameter/merge.ts (groups and aggregates)', () => {
    const scope = () => new Group({
        name: 'scope',
        lowering: {
            fn: undefined,
            field: 'scope',
            args: [],
        },
    });
    const count = () => new Aggregate({
        name: 'count',
        lowering: {
            fn: 'count',
            field: undefined,
            args: [],
        },
    });

    it('should carry the grain of the side that declares it', () => {
        const grouped = new Query({
            groups: new Groups([scope()]),
            aggregates: new Aggregates([count()]),
        });
        const reach = new Query({ filters: new Filters(FilterCompoundOperator.AND, [eq('realm_id', 'a')]) });

        for (const output of [mergeQueries(grouped, reach), mergeQueries(reach, grouped)]) {
            expect(output.groups.value.map((el) => el.key)).toEqual(['scope']);
            expect(output.aggregates.value.map((el) => el.key)).toEqual(['count']);
            expect(conditions(output.filters)).toEqual([['realm_id', 'eq', 'a']]);
        }
    });

    it('should keep one grain when both sides declare the same one', () => {
        const output = mergeQueries(
            new Query({ groups: new Groups([scope()]), aggregates: new Aggregates([count()]) }),
            new Query({ groups: new Groups([scope()]), aggregates: new Aggregates([count()]) }),
        );

        expect(output.groups.value).toHaveLength(1);
        expect(output.aggregates.value).toHaveLength(1);
    });

    it('should refuse two different grains', () => {
        const left = new Query({ groups: new Groups([scope()]) });
        const right = new Query({
            groups: new Groups([new Group({
                name: 'name',
                lowering: {
                    fn: undefined,
                    field: 'name',
                    args: [],
                },
            })]),
        });

        expect(() => mergeQueries(left, right)).toThrowError(MergeError);
        expect(() => mergeQueries(left, right))
            .toThrowError(expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }));
    });

    it('should refuse a merge whose group key equals an aggregate key', () => {
        const left = new Query({
            groups: new Groups([new Group({
                name: 'count',
                lowering: {
                    fn: undefined,
                    field: 'count',
                    args: [],
                },
            })]),
        });
        const right = new Query({ aggregates: new Aggregates([count()]) });

        for (const input of [[left, right], [right, left]]) {
            expect(() => mergeQueries(...input)).toThrowError(MergeError);
            expect(() => mergeQueries(...input))
                .toThrowError(expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }));
        }
    });

    it('should read an external query without the members as empty', () => {
        const external : IQuery = {
            fields: new Fields(),
            filters: new Filters(FilterCompoundOperator.AND, []),
            relations: new Relations(),
            pagination: new Pagination(),
            sorts: new Sorts(),
            accept(visitor) {
                return visitor.visitQuery(this);
            },
        };

        expect(mergeQueries(external).groups.value).toEqual([]);
        expect(mergeQueries(external, new Query({ groups: new Groups([scope()]) }))
            .groups.value.map((el) => el.key)).toEqual(['scope']);
        expect(mergeQueries(new Query({ aggregates: new Aggregates([count()]) }), external)
            .aggregates.value.map((el) => el.key)).toEqual(['count']);
    });
});

/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IFilter } from '../../../src';
import {
    ErrorCode,
    Field,
    Fields,
    FilterCompoundOperator,
    Filters,
    MergeError,
    Query,
    and,
    contains,
    defineQuery,
    eq,
    gte,
    mergeQueries,
    or,
    seal,
} from '../../../src';
import type { User } from '../../data';

const conditions = (filters: { value: unknown[] }) => (filters.value as IFilter[])
    .map((el) => [el.field, el.operator, el.value]);

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

    it('should replace same-field filters with left priority (search over defaults)', () => {
        const searchQ = defineQuery<User>({ filters: { name: { $contains: 'Jo' } } });
        const defaultsQ = defineQuery<User>({ filters: { name: 'John', age: { $gte: 18 } } });

        const output = mergeQueries(searchQ, defaultsQ);

        expect(conditions(output.filters)).toEqual([
            ['name', 'contains', 'Jo'],
            ['age', 'gte', 18],
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

        // per-field replace has no meaning inside a disjunction, so the
        // group is carried through as one inert conjunct.
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
    it('should inject sealed conditions via and() without mutating the receiver', () => {
        const query = defineQuery<User>({ filters: { name: 'John' } });

        const scoped = query.filters.and(eq('realm.id', 'master'));

        // receiver untouched (immutable).
        expect(query.filters.value).toHaveLength(1);

        // the receiver already carries the operator, so the group stays
        // flat and only the injected condition is sealed.
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(conditions(scoped)).toEqual([
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
        ]);
        expect(scoped.value[0].sealed).toBeUndefined();
        expect(scoped.value[1].sealed).toBe(true);
    });

    it('should nest a receiver that carries another operator', () => {
        const receiver = or(eq('name', 'a'), eq('name', 'b'));

        const scoped = receiver.and(eq('realm.id', 'master'));

        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(scoped.value).toHaveLength(2);
        expect(scoped.value[0]).toBe(receiver);
        expect(scoped.value[1].sealed).toBe(true);
    });

    it('should not allow a later replace-merge to displace an injected condition', () => {
        const parsed = defineQuery<User>({ filters: { name: 'John' } });
        const scoped = parsed.filters.and(eq('realm.id', 'master'));

        // the injected condition is sealed, so a same-field condition
        // narrows the result instead of displacing the scope.
        const hostile = new Filters(FilterCompoundOperator.AND, [
            eq('realm.id', 'evil'),
        ]);

        expect(conditions(hostile.merge(scoped))).toEqual([
            ['realm.id', 'eq', 'evil'],
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
        ]);

        // the other direction displaces the hostile condition outright:
        // the receiver already constrains that field.
        expect(conditions(scoped.merge(hostile))).toEqual([
            ['name', 'eq', 'John'],
            ['realm.id', 'eq', 'master'],
        ]);
    });

    it('should survive a normalization pass', () => {
        const scope = eq('realm.id', 'master');
        const scoped = defineQuery().filters.and(scope);
        const hostile = defineQuery<User>({ filters: { 'realm.id': 'evil' } });

        // flatten() collapses same-operator nests; the seal rides on the
        // node, so normalizing cannot turn the scope displaceable.
        const flat = scoped.flatten();

        expect(conditions(hostile.filters.merge(flat))).toEqual([
            ['realm.id', 'eq', 'evil'],
            ['realm.id', 'eq', 'master'],
        ]);
    });

    it('should keep an empty receiver out of the group', () => {
        const query = defineQuery();

        // an empty receiver constrains nothing — as an OR child it would
        // widen the group to everything.
        const scoped = query.filters.and(eq('realm.id', 'master'));
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(conditions(scoped)).toEqual([['realm.id', 'eq', 'master']]);
        expect(scoped.value[0].sealed).toBe(true);

        const alternatives = query.filters.or(eq('name', 'a'), eq('name', 'b'));
        expect(alternatives.operator).toBe(FilterCompoundOperator.OR);
        expect(conditions(alternatives)).toEqual([
            ['name', 'eq', 'a'],
            ['name', 'eq', 'b'],
        ]);
    });

    it('should not allow a replace-merge to displace a condition injected onto an empty receiver', () => {
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

describe('src/parameter/filters/helpers/module.ts seal', () => {
    it('should seal a leaf condition immutably', () => {
        const condition = eq('a', 1);
        const sealed = seal(condition);

        expect(condition.sealed).toBeUndefined();
        expect(sealed.sealed).toBe(true);
        expect(sealed.field).toBe('a');
        expect(sealed.operator).toBe('eq');
        expect(sealed.value).toBe(1);

        // idempotent — an already sealed condition is returned as is.
        expect(seal(sealed)).toBe(sealed);
    });

    it('should seal a group without touching its interior', () => {
        const group = or(eq('a', 1), eq('b', 2));
        const sealed = seal(group);

        expect(group.sealed).toBeUndefined();
        expect(sealed.sealed).toBe(true);
        expect(sealed.value).toEqual(group.value);
    });

    it('should keep a sealed condition undisplaceable through a merge', () => {
        const left = new Filters(FilterCompoundOperator.AND, [eq('realm_id', 'evil')]);
        const right = new Filters(FilterCompoundOperator.AND, [seal(eq('realm_id', 'master'))]);

        expect(conditions(left.merge(right))).toEqual([
            ['realm_id', 'eq', 'evil'],
            ['realm_id', 'eq', 'master'],
        ]);
    });

    it('should not adopt the conditions of a sealed receiver', () => {
        const receiver = seal(and(eq('a', 1)));

        // adopting them into a fresh (unsealed) group would strip the
        // protection its children rely on, so it stays a child instead.
        const output = receiver.and(eq('b', 2));

        expect(output.value).toHaveLength(2);
        expect(output.value[0]).toBe(receiver);
        expect(output.value[1].sealed).toBe(true);
    });

    it('should treat a sealed root as one inert conjunct', () => {
        const sealedRoot = seal(and(eq('a', 1)));
        const other = new Filters(FilterCompoundOperator.AND, [eq('a', 9)]);

        // decomposing it would expose its (unsealed) conditions to
        // per-field replace.
        const output = other.merge(sealedRoot);

        expect(output.value).toHaveLength(2);
        expect(output.value[1]).toBe(sealedRoot);
    });

    it('should leave a condition it cannot seal untouched', () => {
        // a condition that is neither node kind cannot be sealed — and is
        // never displaced or hoisted either, both being isFilter/isFilters
        // decisions.
        const foreign = { operator: 'and', value: [] };

        expect(seal(foreign)).toBe(foreign);
    });

    it('should not hoist a sealed group out of its parent', () => {
        const inner = seal(and(eq('a', 1)));
        const outer = and(eq('b', 2), inner);

        const flat = outer.flatten();

        // hoisting would strip the protection its children rely on.
        expect(flat.value).toHaveLength(2);
        expect(flat.value[1]).toBe(inner);

        // a sealed root keeps its marker across normalization.
        expect(seal(and(and(eq('a', 1)))).flatten().sealed).toBe(true);
    });
});

/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IFilter } from '../../../src';
import {
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    MergeError,
    contains,
    defineQuery,
    eq,
    gte,
    mergeQueries,
    or,
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

    it('should throw a typed error when merging non-flat filters', () => {
        const flat = defineQuery<User>({ filters: { name: 'John' } });
        const nested = defineQuery<User>({ filters: or(gte('age', 18), eq('email', null)) });

        try {
            mergeQueries(flat, nested);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(MergeError);
            expect((e as MergeError).code).toBe(ErrorCode.FILTERS_NOT_FLAT);
        }
    });
});

describe('src/parameter/filters/collection/module.ts combinators', () => {
    it('should inject conditions via and() without mutating the receiver', () => {
        const query = defineQuery<User>({ filters: { name: 'John' } });

        const scoped = query.filters.and(eq('realm.id', 'master'));

        // receiver untouched (immutable).
        expect(query.filters.value).toHaveLength(1);

        // wrap & inject: the original tree becomes a child group.
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(scoped.value).toHaveLength(2);
        expect(scoped.value[0]).toBe(query.filters);
        expect((scoped.value[1] as IFilter).field).toBe('realm.id');
    });

    it('should not allow a later replace-merge to displace an injected condition', () => {
        const parsed = defineQuery<User>({ filters: { name: 'John' } });
        const scoped = parsed.filters.and(eq('realm.id', 'master'));

        // the injected tree is no longer flat — replace-merge is a typed
        // error instead of silently dropping the scoping condition.
        const hostile = new Filters(FilterCompoundOperator.AND, [
            eq('realm.id', 'evil'),
        ]);

        expect(() => hostile.merge(scoped)).toThrowError(MergeError);
        expect(() => scoped.merge(hostile)).toThrowError(MergeError);
    });

    it('should start a fresh group when the receiver is empty', () => {
        const query = defineQuery();

        const scoped = query.filters.and(eq('realm.id', 'master'));
        expect(scoped.operator).toBe(FilterCompoundOperator.AND);
        expect(conditions(scoped)).toEqual([['realm.id', 'eq', 'master']]);

        const alternatives = query.filters.or(eq('name', 'a'), eq('name', 'b'));
        expect(alternatives.operator).toBe(FilterCompoundOperator.OR);
        expect(alternatives.value).toHaveLength(2);
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
});

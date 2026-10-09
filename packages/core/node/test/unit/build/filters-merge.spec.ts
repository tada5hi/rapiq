/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    BuildError,
    defineFilters,
    eq,
    mergeFiltersInput,
} from '../../../src';
import type { IFilter } from '../../../src';
import type { User } from '../../data';

const conditions = (input: unknown) => (defineFilters(input as never).value as IFilter[])
    .map((el) => [el.field, el.operator, el.value]);

describe('src/build/parameter/filters/merge.ts', () => {
    it('should let the first input win a field and keep the rest', () => {
        const output = mergeFiltersInput<User>(
            { name: 'current' },
            { name: 'default', age: { $gte: 18 } },
        );

        expect(conditions(output)).toEqual([
            ['name', 'eq', 'current'],
            ['age', 'gte', 18],
        ]);
    });

    it('should replace across both notations of the same field', () => {
        // an object spread cannot see these are one field, and emits both.
        const output = mergeFiltersInput<User>(
            { realm: { name: 'b' } },
            { 'realm.name': 'a', 'realm.id': 1 },
        );

        expect(output).toEqual({ 'realm.name': 'b', 'realm.id': 1 });
        expect(conditions(output)).toEqual([
            ['realm.name', 'eq', 'b'],
            ['realm.id', 'eq', 1],
        ]);
    });

    it('should replace a nested record key by key rather than wholesale', () => {
        // a shallow spread would drop `realm.id` with the branch it replaces.
        const output = mergeFiltersInput<User>(
            { realm: { name: 'b' } },
            { realm: { name: 'a', id: 1 } },
        );

        expect(output).toEqual({ 'realm.name': 'b', 'realm.id': 1 });
    });

    it('should resolve both notations of one field within a single input', () => {
        const output = mergeFiltersInput<User>({
            'realm.name': 'first',
            realm: { name: 'second' },
        });

        expect(output).toEqual({ 'realm.name': 'first' });
    });

    it('should replace per field rather than per operator', () => {
        const output = mergeFiltersInput<User>(
            { age: { $gte: 18 } },
            { age: { $lt: 65 } },
        );

        // keeping both bounds is conjunction, which is mergeQueries' job.
        expect(conditions(output)).toEqual([['age', 'gte', 18]]);
    });

    it('should treat an undefined value as no opinion', () => {
        const output = mergeFiltersInput<User>(
            { name: undefined, age: 30 },
            { name: 'default' },
        );

        expect(output).toEqual({ age: 30, name: 'default' });
    });

    it('should treat a $elemMatch interior as one value', () => {
        const output = mergeFiltersInput<User>(
            { items: { $elemMatch: { name: 'current' } } },
            { items: { $elemMatch: { name: 'default', id: '2' } } },
        );

        expect(output).toEqual({ items: { $elemMatch: { name: 'current' } } });
    });

    it('should keep every notation of a bare-array and regex leaf intact', () => {
        const pattern = /^Jo/;
        const output = mergeFiltersInput<User>(
            { id: ['1', '2', null] },
            { name: pattern },
        );

        expect(conditions(output)).toEqual([
            ['id', 'in', ['1', '2', null]],
            ['name', 'regex', pattern],
        ]);
    });

    it('should not mutate its inputs', () => {
        const left = { realm: { name: 'b' } };
        const right = { realm: { name: 'a', id: 1 } };

        mergeFiltersInput<User>(left, right);

        expect(left).toEqual({ realm: { name: 'b' } });
        expect(right).toEqual({ realm: { name: 'a', id: 1 } });
    });

    it('should return an empty input without arguments', () => {
        expect(mergeFiltersInput()).toEqual({});
    });

    it('should refuse a live condition instead of replacing inside it', () => {
        // The safety property, and it is a type error before it is a runtime
        // one: replacement never sees a server-authored tree.
        expect(() => mergeFiltersInput(
            // @ts-expect-error a live condition is not build input
            eq('realm_id', 'master'),
        )).toThrow(BuildError);
    });

    it('should leave an invalid $-prefixed root key for defineFilters to report', () => {
        // untyped call sites reach the permissive arm, where a `$` key is
        // indistinguishable from a field name, so the report stays where it
        // already was rather than being duplicated here.
        const output = mergeFiltersInput({ $eq: 'x' });

        expect(output).toEqual({ $eq: 'x' });
        expect(() => defineFilters(output)).toThrow(BuildError);
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    ErrorCode,
    FilterCompoundOperator,
    Filters,
    ITSELF,
    Query,
    and,
    contains,
    elemMatch,
    endsWith,
    eq,
    exists,
    gt,
    gte,
    inArray,
    lt,
    mod,
    ne,
    nin,
    not,
    notContains,
    or,
    regex,
    size,
    startsWith,
} from '@rapiq/core';
import { PrismaAdapter } from '../../src';
import { createAdapterOptions } from '../data/schema';

function build(condition: Condition, options: Record<string, any> = {}) {
    const adapter = new PrismaAdapter(createAdapterOptions(options));
    const { args } = adapter.execute(new Query({ filters: new Filters(FilterCompoundOperator.AND, [condition]) }));

    return args.where;
}

describe('src/adapter/filters.ts', () => {
    describe('equality', () => {
        it('should render eq', () => {
            expect(build(eq('first_name', 'Peter'))).toEqual({ first_name: { equals: 'Peter', mode: 'insensitive' } });
        });

        it('should render ne as the exact null-inclusive complement', () => {
            expect(build(ne('address', 'Mordor'))).toEqual({
                OR: [
                    { address: { not: 'Mordor', mode: 'insensitive' } },
                    { address: null },
                ],
            });
        });

        it('should drop the null arm for a non-nullable column', () => {
            expect(build(ne('first_name', 'Peter'))).toEqual({ first_name: { not: 'Peter', mode: 'insensitive' } });
        });

        it('should render an eq against null as is null', () => {
            expect(build(eq('address', null))).toEqual({ address: null });
        });

        it('should render a ne against null as is not null', () => {
            expect(build(ne('address', null))).toEqual({ address: { not: null } });
        });

        it('should decide a null check on a non-nullable column', () => {
            // the column cannot hold null, so the condition is constant:
            // and prisma would reject the null comparison outright.
            expect(build(eq('first_name', null))).toEqual({ OR: [] });
            expect(build(ne('first_name', null))).toBeUndefined();
        });

        it('should render exists', () => {
            expect(build(exists('address'))).toEqual({ address: { not: null } });
            expect(build(exists('address', false))).toEqual({ address: null });
        });
    });

    describe('ordering', () => {
        it('should render comparisons', () => {
            expect(build(gte('age', 18))).toEqual({ age: { gte: 18 } });
            expect(build(lt('age', 18))).toEqual({ age: { lt: 18 } });
        });

        it('should complement a comparison with the inverse operator', () => {
            // age is non-nullable, so the complement needs no null arm.
            expect(build(not(gt('age', 18)))).toEqual({ age: { lte: 18 } });
        });

        it('should never case-fold an ordering comparison', () => {
            expect(build(gte('first_name', 'a'))).toEqual({ first_name: { gte: 'a' } });
        });
    });

    describe('membership', () => {
        it('should render in', () => {
            expect(build(inArray('id', [1, 2]))).toEqual({ id: { in: [1, 2] } });
        });

        it('should render nin as the exact complement', () => {
            expect(build(nin('address', ['Mordor']))).toEqual({
                OR: [
                    { address: { notIn: ['Mordor'], mode: 'insensitive' } },
                    { address: null },
                ],
            });
        });

        it('should split a null member out of the value list', () => {
            expect(build(inArray('realm_id', [1, null]))).toEqual({
                OR: [
                    { realm_id: { in: [1] } },
                    { realm_id: null },
                ],
            });
        });

        it('should render the negated null-member case null-exclusively', () => {
            expect(build(nin('realm_id', [1, null]))).toEqual({
                AND: [
                    { realm_id: { notIn: [1] } },
                    { realm_id: { not: null } },
                ],
            });
        });

        it('should fold an empty membership list to a constant', () => {
            // `in([])` matches nothing, `nin([])` everything.
            expect(build(inArray('id', []))).toEqual({ OR: [] });
            expect(build(nin('id', []))).toBeUndefined();
        });
    });

    describe('anchored', () => {
        it('should render the anchored operators', () => {
            expect(build(contains('first_name', 'et'))).toEqual({ first_name: { contains: 'et', mode: 'insensitive' } });
            expect(build(startsWith('first_name', 'Pe'))).toEqual({ first_name: { startsWith: 'Pe', mode: 'insensitive' } });
            expect(build(endsWith('first_name', 'er'))).toEqual({ first_name: { endsWith: 'er', mode: 'insensitive' } });
        });

        it('should keep mode a sibling of not in the negated form', () => {
            expect(build(notContains('address', 'wart'))).toEqual({
                OR: [
                    { address: { not: { contains: 'wart' }, mode: 'insensitive' } },
                    { address: null },
                ],
            });
        });
    });

    describe('case sensitivity', () => {
        it('should omit mode for a provider without insensitive filters', () => {
            expect(build(eq('first_name', 'Peter'), { provider: 'mysql' })).toEqual({ first_name: { equals: 'Peter' } });
        });

        it('should omit mode for a non-string column', () => {
            expect(build(eq('age', 18))).toEqual({ age: { equals: 18 } });
        });

        it('should honor the per-field opt-out', () => {
            expect(build(eq('email', 'a@b.c'), { caseSensitive: ['email'] })).toEqual({ email: { equals: 'a@b.c' } });
        });

        it('should keep membership case-insensitive despite a wildcard', () => {
            // measured: `in`/`notIn` are never lowered to ILIKE, so the
            // veto below does not apply to them.
            expect(build(inArray('email', ['john_doe@x.com']))).toEqual({ email: { in: ['john_doe@x.com'], mode: 'insensitive' } });
        });

        it('should not case-fold a value carrying a like wildcard', () => {
            // `mode: 'insensitive'` lowers equals to ILIKE, where `_`
            // and `%` would silently widen the match.
            expect(build(eq('email', 'john_doe@x.com'))).toEqual({ email: { equals: 'john_doe@x.com' } });
        });
    });

    describe('compounds', () => {
        it('should render and/or', () => {
            expect(build(or(eq('id', 1), eq('id', 2)))).toEqual({
                OR: [
                    { id: { equals: 1 } },
                    { id: { equals: 2 } },
                ],
            });
        });

        it('should push a group negation down to the leaves', () => {
            // prisma NOT is three-valued and would drop null rows, so
            // De Morgan is applied instead, and no NOT key is emitted.
            expect(build(not(and(eq('id', 1), gt('age', 18))))).toEqual({
                OR: [
                    { id: { not: 1 } },
                    { age: { lte: 18 } },
                ],
            });
        });

        it('should cancel a double negation', () => {
            expect(build(not(not(eq('id', 1))))).toEqual({ id: { equals: 1 } });
        });

        it('should fold a constant child out of a compound', () => {
            expect(build(and(eq('id', 1), nin('id', [])))).toEqual({ id: { equals: 1 } });
            expect(build(and(eq('id', 1), inArray('id', [])))).toEqual({ OR: [] });
            expect(build(or(eq('id', 1), nin('id', [])))).toBeUndefined();
        });
    });

    describe('relation paths', () => {
        it('should traverse a to-one relation with is', () => {
            expect(build(eq('realm.name', 'master'))).toEqual({ realm: { is: { name: { equals: 'master', mode: 'insensitive' } } } });
        });

        it('should admit an absent to-one relation in the complement', () => {
            expect(build(ne('realm.name', 'master'))).toEqual({
                OR: [
                    { realm: { is: { name: { not: 'master', mode: 'insensitive' } } } },
                    { NOT: { realm: { is: {} } } },
                ],
            });
        });

        it('should traverse a to-many relation with some', () => {
            expect(build(eq('items.title', 'book'))).toEqual({ items: { some: { title: { equals: 'book', mode: 'insensitive' } } } });
        });

        it('should quantify a negated to-many condition existentially', () => {
            // a left join evaluates the condition per joined row, so a
            // record with a matching *and* a non-matching element
            // satisfies both the condition and its negation: `none`
            // would be the row-level complement instead.
            expect(build(ne('items.title', 'book'))).toEqual({
                OR: [
                    { items: { some: { title: { not: 'book', mode: 'insensitive' } } } },
                    { items: { none: {} } },
                ],
            });
        });

        it('should treat an empty collection as one null binding', () => {
            expect(build(eq('items.color', null))).toEqual({
                OR: [
                    { items: { some: { color: null } } },
                    { items: { none: {} } },
                ],
            });

            expect(build(ne('items.color', null))).toEqual({ items: { some: { color: { not: null } } } });
        });

        it('should express a null check on a relation as a presence test', () => {
            // prisma rejects `not: null` on a relation field.
            expect(build(exists('realm'))).toEqual({ realm: { is: {} } });
            expect(build(exists('realm', false))).toEqual({ NOT: { realm: { is: {} } } });

            // a collection is always present, never absent, the same
            // answer @rapiq/adapter-memory gives.
            expect(build(exists('items'))).toBeUndefined();
            expect(build(exists('items', false))).toEqual({ OR: [] });
        });

        it('should decide a null check on a required column behind a relation', () => {
            // the column cannot hold null, so only the traversal selects.
            expect(build(eq('realm.name', null))).toEqual({ NOT: { realm: { is: {} } } });
            expect(build(ne('realm.name', null))).toEqual({ realm: { is: {} } });
        });

        it('should drop a dead null member on a required column', () => {
            expect(build(inArray('first_name', ['a', null]))).toEqual({ first_name: { in: ['a'], mode: 'insensitive' } });
        });

        it('should accept an explicit to-many declaration without metadata', () => {
            expect(build(eq('items.title', 'book'), { relations: { toMany: ['items'] } })).toEqual({ items: { some: { title: { equals: 'book', mode: 'insensitive' } } } });
        });
    });

    describe('elemMatch', () => {
        it('should render a single some scope', () => {
            expect(build(elemMatch('items', and(eq('title', 'book'), eq('color', 'red'))))).toEqual({
                items: {
                    some: {
                        AND: [
                            { title: { equals: 'book', mode: 'insensitive' } },
                            { color: { equals: 'red', mode: 'insensitive' } },
                        ],
                    },
                },
            });
        });

        it('should complement per binding, with the quantifier outside', () => {
            // the settled contract: group negation applies per binding
            // (memory negates per binding context, sql wraps CASE per
            // join row), so not(elemMatch(c)) selects records with an
            // element FAILING c, plus empty collections.
            expect(build(not(elemMatch('items', eq('title', 'book'))))).toEqual({
                OR: [
                    { items: { some: { title: { not: 'book', mode: 'insensitive' } } } },
                    { items: { none: {} } },
                ],
            });
        });

        it('should cover the empty collection when the interior matches null', () => {
            expect(build(elemMatch('items', eq('color', null)))).toEqual({
                OR: [
                    { items: { some: { color: null } } },
                    { items: { none: {} } },
                ],
            });
        });
    });

    describe('unsupported features', () => {
        const cases : [string, Condition][] = [
            ['regex', regex('first_name', '^Pe')],
            ['mod', mod('age', 2, 0)],
            ['size', size('items', 2)],
            // the residual negation wrapper stays typed instead of
            // silently rendering the positive form.
            ['negated mod', not(mod('age', 2, 0))],
            ['negated size', not(size('items', 2))],
            // the bound element itself is not a prisma column; the
            // gate must throw here instead of emitting a `$this` key
            // and leaning on prisma's unknown-field error.
            ['itself', eq(ITSELF, 'Peter')],
        ];

        cases.forEach(([name, condition]) => {
            it(`should fail typed for ${name}`, () => {
                expect(() => build(condition)).toThrowError(
                    expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED }),
                );
            });
        });
    });
});

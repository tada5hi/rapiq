/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from '@rapiq/core';
import {
    FiltersAdapter, 
    type FiltersContainerOptions, 
    FiltersVisitor, 
    RelationsAdapter, 
    pg,
} from '../../../src';

const options: FiltersContainerOptions = { ...pg };

describe('compound operators', () => {
    let adapter : FiltersAdapter;
    let visitor : FiltersVisitor;

    beforeEach(() => {
        const relationsAdapter = new RelationsAdapter();
        adapter = new FiltersAdapter(
            relationsAdapter,
            options,
        );

        visitor = new FiltersVisitor(adapter);
    });

    it('generates query with inverted condition for "not"', () => {
        const condition = new Filters('not', [
            new Filters('or', [
                new Filter('eq', 'age', 12),
                new Filter('eq', 'age', 13),
            ]),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        // exact complement: the CASE wrapper collapses UNKNOWN to
        // false, so null-bearing rows match the negation.
        expect(sql).toEqual('case when ("age" = $1 or "age" = $2) then 1 else 0 end = 0');
        expect([12, 13]).toStrictEqual(params);
    });

    it('generates a null-inclusive complement for a negated ordering condition', () => {
        const condition = new Filters('not', [
            new Filter('gt', 'age', 50),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('case when "age" > $1 then 1 else 0 end = 0');
        expect(params).toStrictEqual([50]);
    });

    it('renders a single-child negated equality via its complement twin', () => {
        const condition = new Filters('not', [
            new Filter('eq', 'age', 18),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        // not(eq) normalizes onto the ne plan — identical rendering.
        expect(sql).toEqual('("age" <> $1 or "age" is null)');
        expect(params).toStrictEqual([18]);
    });

    it('generates query combined by logical `and` for "and"', () => {
        const condition = new Filters(
            'and',
            [
                new Filter('eq', 'age', 1),
                new Filter('eq', 'active', true),
            ],
        );
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("age" = $1 and "active" = $2)');
        expect(params).toStrictEqual([1, true]);
    });

    it('generates query combined by logical `or` for "or"', () => {
        const condition = new Filters('or', [
            new Filter('eq', 'age', 1),
            new Filter('eq', 'active', true),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("age" = $1 or "active" = $2)');
        expect(params).toStrictEqual([1, true]);
    });

    it('generates inverted query combined by logical `or` for "nor"', () => {
        const condition = new Filters('nor', [
            new Filter('eq', 'age', 1),
            new Filter('eq', 'active', true),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('case when ("age" = $1 or "active" = $2) then 1 else 0 end = 0');
        expect(params).toStrictEqual([1, true]);
    });

    it('properly adds brackets for complex compound condition', () => {
        const condition = new Filters('or', [
            new Filters('or', [
                new Filter('eq', 'age', 1),
                new Filter('eq', 'age', 2),
            ]),
            new Filters('and', [
                new Filter('gt', 'qty', 1),
                new Filter('lt', 'qty', 20),
            ]),
            new Filters('nor', [
                new Filter('gt', 'qty', 10),
                new Filter('lt', 'qty', 20),
            ]),
            new Filters('not', [new Filters('and', [
                new Filter('eq', 'active', false),
                new Filter('gt', 'age', 18),
            ])]),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`(${[
            '("age" = $1 or "age" = $2)',
            'or ("qty" > $3 and "qty" < $4)',
            'or case when ("qty" > $5 or "qty" < $6) then 1 else 0 end = 0',
            'or case when ("active" = $7 and "age" > $8) then 1 else 0 end = 0',
        ].join(' ')})`);
        expect(params).toStrictEqual([1, 2, 1, 20, 10, 20, false, 18]);
    });

    it('wraps a nested compound even when its first condition is parenthesized', () => {
        const condition = new Filters('and', [
            new Filter('eq', 'name', 'x'),
            new Filters('or', [
                new Filter('in', 'realm_id', ['a', null]),
                new Filter('eq', 'age', 18),
            ]),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(
            '(lower("name") = lower($1) and ((lower("realm_id") in(lower($2)) or "realm_id" is null) or "age" = $3))',
        );
        expect(params).toStrictEqual(['x', 'a', 18]);
    });
});

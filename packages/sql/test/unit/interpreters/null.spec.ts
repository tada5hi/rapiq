/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from '@rapiq/core';
import {
    FiltersAdapter,
    FiltersVisitor,
    RelationsAdapter,
    pg,
} from '../../../src';

describe('null semantics', () => {
    let adapter : FiltersAdapter;
    let visitor : FiltersVisitor;

    beforeEach(() => {
        adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        visitor = new FiltersVisitor(adapter);
    });

    it('rewrites equal null to IS NULL', () => {
        new Filter('eq', 'realm_id', null).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual(['"realm_id" is null', []]);
    });

    it('rewrites not equal null to IS NOT NULL', () => {
        new Filter('ne', 'realm_id', null).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual(['"realm_id" is not null', []]);
    });

    it('rewrites in with null element to IN OR IS NULL', () => {
        new Filter('in', 'realm_id', ['a', 'b', null]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '("realm_id" in($1, $2) or "realm_id" is null)',
            ['a', 'b'],
        ]);
    });

    it('rewrites in with only null to IS NULL', () => {
        new Filter('in', 'realm_id', [null]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual(['"realm_id" is null', []]);
    });

    it('rewrites not in with null element to NOT IN AND IS NOT NULL', () => {
        new Filter('nin', 'realm_id', ['a', null]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '("realm_id" not in($1) and "realm_id" is not null)',
            ['a'],
        ]);
    });

    it('rewrites not in with only null to IS NOT NULL', () => {
        new Filter('nin', 'realm_id', [null]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual(['"realm_id" is not null', []]);
    });

    it('keeps placeholder numbering continuous around null rewrites', () => {
        new Filters('and', [
            new Filter('eq', 'name', 'admin'),
            new Filter('in', 'realm_id', ['a', null]),
            new Filter('eq', 'age', 18),
        ]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '("name" = $1 and ("realm_id" in($2) or "realm_id" is null) and "age" = $3)',
            ['admin', 'a', 18],
        ]);
    });
});

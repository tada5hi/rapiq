/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode, Filter } from '@rapiq/core';
import {
    FiltersAdapter,
    FiltersVisitor,
    RelationsAdapter,
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '../../../src';

describe('mod', () => {
    it('generates call to `mod` function for PostgreSQL', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        const visitor = new FiltersVisitor(adapter);

        new Filter('mod', 'qty', [4, 0]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            'mod("qty", $1) = $2',
            [4, 0],
        ]);
    });

    it('generates call to `mod` function for MySQL', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), mysql);
        const visitor = new FiltersVisitor(adapter);

        new Filter('mod', 'qty', [4, 0]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            'mod(`qty`, ?) = ?',
            [4, 0],
        ]);
    });

    it('generates call to `mod` function for SQLite', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), sqlite);
        const visitor = new FiltersVisitor(adapter);

        new Filter('mod', 'qty', [4, 0]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            'mod(`qty`, ?) = ?',
            [4, 0],
        ]);
    });

    it('generates call to `mod` function for Oracle', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), oracle);
        const visitor = new FiltersVisitor(adapter);

        new Filter('mod', 'qty', [4, 0]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            'mod("qty", :1) = :2',
            [4, 0],
        ]);
    });

    // SQL Server has no MOD() function; A2 (plan 032) adds it via the `%`
    // operator instead of the unconditional mod(...) rendering, which was
    // invalid T-SQL and reached the database as an opaque syntax error.
    it('generates a `%` condition for SQL Server', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), mssql);
        const visitor = new FiltersVisitor(adapter);

        new Filter('mod', 'qty', [4, 0]).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '[qty] % ? = ?',
            [4, 0],
        ]);
    });

    it('throws a typed featureUnsupported(filters:mod) error when the dialect omits mod', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), { ...pg, mod: undefined });
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('mod', 'qty', [4, 0]);

        try {
            condition.accept(visitor);
            expect.fail('mod must throw');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toEqual(ErrorCode.FEATURE_UNSUPPORTED);
        }
    });
});

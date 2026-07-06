/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, Filter } from '@rapiq/core';
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

describe('regex', () => {
    it('generates posix operator for PostgresSQL', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            pg,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"email" ~ $1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('generates posix operator for Oracle', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            oracle,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"email" ~ $1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('generates call to `REGEXP` function for MySQL', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            mysql,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('`email` regexp ? = 1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('throws a typed error for MSSQL as it does not support REGEXP', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            mssql,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);

        expect(() => {
            condition.accept(visitor);
        }).toThrow(AdapterError);
        expect(() => {
            condition.accept(visitor);
        }).toThrow('The feature regexp is not supported by the dialect.');
    });

    it('falls back to LIKE for anchored operators on MSSQL', () => {
        const buildAdapter = () => {
            const adapter = new FiltersAdapter(new RelationsAdapter(), mssql);
            return { adapter, visitor: new FiltersVisitor(adapter) };
        };

        let { adapter, visitor } = buildAdapter();
        new Filter('startsWith', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'\\\'', 
            ['foo%'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('endsWith', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'\\\'', 
            ['%foo'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('contains', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'\\\'', 
            ['%foo%'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('notContains', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] not like ? escape \'\\\'', 
            ['%foo%'],
        ]);
    });

    it('escapes LIKE wildcards in the fallback pattern', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), mssql);
        const visitor = new FiltersVisitor(adapter);

        new Filter('contains', 'name', '100%_[a]').accept(visitor);

        const [, params] = adapter.getQueryAndParameters();
        expect(params).toStrictEqual(['%100\\%\\_\\[a]%']);
    });

    it('falls back to LIKE for anchored operators on SQLite', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), sqlite);
        const visitor = new FiltersVisitor(adapter);

        new Filter('startsWith', 'name', 'foo').accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '`name` like ? escape \'\\\'',
            ['foo%'],
        ]);
    });

    it('throws a typed error for the regex operator on SQLite', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), sqlite);
        const visitor = new FiltersVisitor(adapter);

        expect(() => {
            new Filter('regex', 'email', /@/).accept(visitor);
        }).toThrow(AdapterError);
    });

    it('generates anchored patterns for anchored operators on regexp dialects', () => {
        const cases : [string, string][] = [
            ['startsWith', '^foo'],
            ['endsWith', 'foo$'],
            ['contains', 'foo'],
            ['notStartsWith', '^(?!foo).*'],
            ['notEndsWith', '^(?!.*foo$).*'],
            ['notContains', '^(?!.*foo).*'],
        ];

        for (const [operator, pattern] of cases) {
            const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
            const visitor = new FiltersVisitor(adapter);

            new Filter(operator, 'name', 'foo').accept(visitor);

            const [sql, params] = adapter.getQueryAndParameters();
            expect(sql, operator).toEqual('"name" ~* $1');
            expect(params, operator).toStrictEqual([pattern]);
        }
    });
});

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

    it('passes a string regex pattern through for PostgresSQL', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        const visitor = new FiltersVisitor(adapter);

        new Filter('regex', 'email', '@example\\.com$').accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '"email" ~ $1',
            ['@example\\.com$'],
        ]);
    });

    it('leaves string regex validation to the database', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        const visitor = new FiltersVisitor(adapter);

        new Filter('regex', 'email', '(').accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '"email" ~ $1',
            ['('],
        ]);
    });

    it('rejects values that are neither RegExp nor string', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        const visitor = new FiltersVisitor(adapter);

        // e.g. a cross-realm RegExp or a plain number must fail typed
        // instead of being bound raw as the pattern parameter.
        expect(() => new Filter('regex', 'email', 42 as never).accept(visitor))
            .toThrow(AdapterError);
    });

    it('generates REGEXP_LIKE for Oracle', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            oracle,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('regexp_like("email", :1)');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('passes the case-insensitive match parameter to Oracle', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), oracle);
        const visitor = new FiltersVisitor(adapter);

        new Filter('regex', 'email', /@/i).accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            'regexp_like("email", :1, \'i\')',
            ['@'],
        ]);
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
            '([name] not like ? escape \'\\\' or [name] is null)',
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
        const cases : [string, string, boolean][] = [
            ['startsWith', '^foo', false],
            ['endsWith', 'foo$', false],
            ['contains', 'foo', false],
            ['notStartsWith', '^(?!foo).*', true],
            ['notEndsWith', '^(?!.*foo$).*', true],
            ['notContains', '^(?!.*foo).*', true],
        ];

        for (const [operator, pattern, negated] of cases) {
            const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
            const visitor = new FiltersVisitor(adapter);

            new Filter(operator, 'name', 'foo').accept(visitor);

            const [sql, params] = adapter.getQueryAndParameters();
            expect(sql, operator).toEqual(negated ?
                '("name" ~* $1 or "name" is null)' :
                '"name" ~* $1');
            expect(params, operator).toStrictEqual([pattern]);
        }
    });
});

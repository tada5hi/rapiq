/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, Filter } from '@rapiq/core';
import type { DialectOptions } from '../../../src';
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

        try {
            condition.accept(visitor);
            expect.fail('regex must throw');
        } catch (e) {
            // A6 (plan 032): the tag is also available structured, not
            // only embedded in the message text.
            expect((e as AdapterError).feature).toBe('regexp');
        }
    });

    it('renders anchored operators as LIKE on MSSQL', () => {
        const buildAdapter = () => {
            const adapter = new FiltersAdapter(new RelationsAdapter(), mssql);
            return { adapter, visitor: new FiltersVisitor(adapter) };
        };

        let { adapter, visitor } = buildAdapter();
        new Filter('startsWith', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'!\'', 
            ['foo%'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('endsWith', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'!\'', 
            ['%foo'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('contains', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '[name] like ? escape \'!\'', 
            ['%foo%'],
        ]);

        ({ adapter, visitor } = buildAdapter());
        new Filter('notContains', 'name', 'foo').accept(visitor);
        expect(adapter.getQueryAndParameters()).toEqual([
            '([name] not like ? escape \'!\' or [name] is null)',
            ['%foo%'],
        ]);
    });

    it('escapes LIKE wildcards and the escape character in the pattern', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), mssql);
        const visitor = new FiltersVisitor(adapter);

        new Filter('contains', 'name', '100%_[a]').accept(visitor);

        const [, params] = adapter.getQueryAndParameters();
        expect(params).toStrictEqual(['%100!%!_![a]%']);
    });

    it('renders anchored operators as LIKE on SQLite', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), sqlite);
        const visitor = new FiltersVisitor(adapter);

        new Filter('startsWith', 'name', 'foo').accept(visitor);

        expect(adapter.getQueryAndParameters()).toEqual([
            '`name` like ? escape \'!\'',
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

    it('renders anchored operators as LIKE on regexp dialects', () => {
        // negations render a plain `not like` over the POSITIVE
        // pattern, null-inclusive via the complement arm.
        const cases : [string, string, boolean][] = [
            ['startsWith', 'foo%', false],
            ['endsWith', '%foo', false],
            ['contains', '%foo%', false],
            ['notStartsWith', 'foo%', true],
            ['notEndsWith', '%foo', true],
            ['notContains', '%foo%', true],
        ];

        for (const [operator, pattern, negated] of cases) {
            const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
            const visitor = new FiltersVisitor(adapter);

            new Filter(operator, 'name', 'foo').accept(visitor);

            const [sql, params] = adapter.getQueryAndParameters();
            expect(sql, operator).toEqual(negated ?
                '(lower("name") not like lower($1) escape \'!\' or "name" is null)' :
                'lower("name") like lower($1) escape \'!\'');
            expect(params, operator).toStrictEqual([pattern]);
        }
    });

    it('drops the fold for an anchored operator on a case-sensitive field', () => {
        const adapter = new FiltersAdapter(new RelationsAdapter(), pg);
        const visitor = new FiltersVisitor(adapter, { caseSensitive: ['path'] });

        new Filter('startsWith', 'path', 'sales/').accept(visitor);

        // the index-usable form: a plain prefix LIKE over `path`
        expect(adapter.getQueryAndParameters()).toEqual([
            '"path" like $1 escape \'!\'',
            ['sales/%'],
        ]);
    });

    it('escapes the escape character in the value', () => {
        // an unescaped `!` in the pattern would swallow the character
        // after it, since the emitted clause declares it as the escape
        const adapter = new FiltersAdapter(new RelationsAdapter(), sqlite);

        new Filter('contains', 'name', 'wow!%').accept(new FiltersVisitor(adapter));

        const [, params] = adapter.getQueryAndParameters();
        expect(params).toStrictEqual(['%wow!!!%%']);
    });

    it('escapes a bracket only where it opens a character range', () => {
        // MSSQL: `[` is a wildcard, so it has to be escaped. Everywhere
        // else it is an ordinary character, and Oracle rejects an escape
        // character followed by anything but %, _ or itself (ORA-01424).
        const render = (dialect: DialectOptions) : unknown[] => {
            const adapter = new FiltersAdapter(new RelationsAdapter(), dialect);
            new Filter('contains', 'name', '[draft]').accept(new FiltersVisitor(adapter));

            const [, params] = adapter.getQueryAndParameters();

            return params;
        };

        expect(render(mssql)).toStrictEqual(['%![draft]%']);
        expect(render(oracle)).toStrictEqual(['%[draft]%']);
        expect(render(pg)).toStrictEqual(['%[draft]%']);
        expect(render(sqlite)).toStrictEqual(['%[draft]%']);
    });

    it('keeps LIKE unfolded where the dialect LIKE is already case-insensitive', () => {
        for (const dialect of [sqlite, mysql]) {
            const adapter = new FiltersAdapter(new RelationsAdapter(), dialect);
            const visitor = new FiltersVisitor(adapter);

            new Filter('contains', 'name', 'foo').accept(visitor);

            const [sql] = adapter.getQueryAndParameters();
            expect(sql).toEqual('`name` like ? escape \'!\'');
        }
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    Filters,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    Sorts,
} from '@rapiq/core';
import type { DialectOptions } from '../../src';
import {
    Adapter,
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '../../src';

const buildQuery = () => new Query({
    fields: new Fields([
        new Field('id'),
        new Field('name'),
        new Field('realm.name'),
    ]),
    filters: new Filters('and', [
        new Filter('gte', 'age', 18),
        new Filter('in', 'realm.id', ['a', null]),
    ]),
    relations: new Relations([new Relation('realm')]),
    sorts: new Sorts([new Sort('age', 'DESC')]),
    pagination: new Pagination(25, 50),
});

const buildFragments = (dialect: DialectOptions) => {
    const adapter = new Adapter({ ...dialect, rootAlias: 'user' });

    return adapter.execute(buildQuery());
};

describe('src/adapter/module.ts', () => {
    const dialects : [string, DialectOptions, {
        columns: string[],
        where: string,
        orderBy: string[],
    }][] = [
        // string equality folds through lower() on dialects whose `=` is
        // case-sensitive (pg, oracle, sqlite); mysql/mssql default collations
        // already compare case-insensitively, so their presets skip it.
        ['pg', pg, {
            columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
            where: '("user"."age" >= $1 and (lower("realm"."id") in(lower($2)) or "realm"."id" is null))',
            orderBy: ['"user"."age" DESC'],
        }],
        ['oracle', oracle, {
            columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
            where: '("user"."age" >= $1 and (lower("realm"."id") in(lower($2)) or "realm"."id" is null))',
            orderBy: ['"user"."age" DESC'],
        }],
        ['mysql', mysql, {
            columns: ['`user`.`id`', '`user`.`name`', '`realm`.`name`'],
            where: '(`user`.`age` >= ? and (`realm`.`id` in(?) or `realm`.`id` is null))',
            orderBy: ['`user`.`age` DESC'],
        }],
        ['sqlite', sqlite, {
            columns: ['`user`.`id`', '`user`.`name`', '`realm`.`name`'],
            where: '(`user`.`age` >= ? and (lower(`realm`.`id`) in(lower(?)) or `realm`.`id` is null))',
            orderBy: ['`user`.`age` DESC'],
        }],
        ['mssql', mssql, {
            columns: ['[user].[id]', '[user].[name]', '[realm].[name]'],
            where: '([user].[age] >= ? and ([realm].[id] in(?) or [realm].[id] is null))',
            orderBy: ['[user].[age] DESC'],
        }],
    ];

    it.each(dialects)('should build fragments for %s', (_name, dialect, expected) => {
        const fragments = buildFragments(dialect);

        expect(fragments).toEqual({
            columns: expected.columns,
            where: expected.where,
            params: [18, 'a'],
            orderBy: expected.orderBy,
            limit: 25,
            offset: 50,
            relations: ['realm'],
        });
    });

    it('should build fragments without a root alias', () => {
        const adapter = new Adapter(pg);

        const fragments = adapter.execute(buildQuery());
        expect(fragments.columns).toEqual(['"id"', '"name"', '"realm"."name"']);
        expect(fragments.where).toEqual('("age" >= $1 and (lower("realm"."id") in(lower($2)) or "realm"."id" is null))');
    });

    it('should drop excluded fields from the columns', () => {
        const adapter = new Adapter(pg);

        const query = new Query({
            fields: new Fields([
                new Field('id'),
                new Field('email', '-'),
            ]),
        });

        expect(adapter.execute(query).columns).toEqual(['"id"']);
    });

    it('should expand and dedupe relation paths', () => {
        const adapter = new Adapter(pg);

        const query = new Query({
            relations: new Relations([
                new Relation('items.realm'),
                new Relation('items.user'),
            ]),
        });

        expect(adapter.execute(query).relations).toEqual([
            'items',
            'items.realm',
            'items.user',
        ]);
    });

    it('should path-qualify nested relation references', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'user' });

        // `realm` and `role.realm` end in the same segment — leaf-based
        // aliasing would collapse both onto the alias `realm` (#744).
        const query = new Query({
            fields: new Fields([
                new Field('realm.name'),
                new Field('role.realm.name'),
            ]),
            filters: new Filters('and', [
                new Filter('eq', 'role.realm.name', 'master'),
            ]),
            sorts: new Sorts([new Sort('role.realm.name', 'ASC')]),
        });

        const fragments = adapter.execute(query);

        expect(fragments.columns).toEqual(['"realm"."name"', '"role_realm"."name"']);
        expect(fragments.where).toEqual('lower("role_realm"."name") = lower($1)');
        expect(fragments.orderBy).toEqual(['"role_realm"."name" ASC']);
        expect(fragments.relations).toEqual(['realm', 'role', 'role.realm']);
    });

    it('should derive relation aliases via a custom function', () => {
        const adapter = new Adapter({
            ...pg,
            relationAlias: (path) => path.replace(/\./g, '__'),
        });

        const query = new Query({ fields: new Fields([new Field('role.realm.name')]) });

        expect(adapter.execute(query).columns).toEqual(['"role__realm"."name"']);
    });

    it('should clear accumulated state between executes by default', () => {
        const adapter = new Adapter(pg);

        const first = adapter.execute(buildQuery());
        const second = adapter.execute(buildQuery());

        // default clear makes execute() re-runnable — no double-accumulation
        expect(second).toEqual(first);
    });

    it('should reset every sub-adapter on the default clear', () => {
        const adapter = new Adapter(pg);

        // first run populates every parameter
        adapter.execute(buildQuery());

        // a second run that omits sort, pagination and relations must not
        // leak the previous run's state. sort/pagination/relations overwrite
        // or dedupe rather than append, so re-walking the *same* query would
        // hide a broken clear() — dropping the parameters is what exposes it.
        const query = new Query({ fields: new Fields([new Field('id')]) });
        const fragments = adapter.execute(query);

        expect(fragments.orderBy).toEqual([]);
        expect(fragments.limit).toBeUndefined();
        expect(fragments.offset).toBeUndefined();
        expect(fragments.relations).toEqual([]);
    });

    it('should accumulate across executes when clear is disabled', () => {
        const adapter = new Adapter(pg);

        adapter.execute(buildQuery());
        const fragments = adapter.execute(buildQuery(), { clear: false });

        // append-style sub-adapters stack instead of resetting:
        // filter conditions/params and selected columns both double
        expect(fragments.params).toEqual([18, 'a', 18, 'a']);
        expect(fragments.columns).toHaveLength(6);
    });
});

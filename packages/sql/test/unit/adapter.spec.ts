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
        ['pg', pg, {
            columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
            where: '("user"."age" >= $1 and ("realm"."id" in($2) or "realm"."id" is null))',
            orderBy: ['"user"."age" DESC'],
        }],
        ['oracle', oracle, {
            columns: ['"user"."id"', '"user"."name"', '"realm"."name"'],
            where: '("user"."age" >= $1 and ("realm"."id" in($2) or "realm"."id" is null))',
            orderBy: ['"user"."age" DESC'],
        }],
        ['mysql', mysql, {
            columns: ['`user`.`id`', '`user`.`name`', '`realm`.`name`'],
            where: '(`user`.`age` >= ? and (`realm`.`id` in(?) or `realm`.`id` is null))',
            orderBy: ['`user`.`age` DESC'],
        }],
        ['sqlite', sqlite, {
            columns: ['`user`.`id`', '`user`.`name`', '`realm`.`name`'],
            where: '(`user`.`age` >= ? and (`realm`.`id` in(?) or `realm`.`id` is null))',
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
        expect(fragments.where).toEqual('("age" >= $1 and ("realm"."id" in($2) or "realm"."id" is null))');
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

    it('should clear accumulated state between executes by default', () => {
        const adapter = new Adapter(pg);

        const first = adapter.execute(buildQuery());
        const second = adapter.execute(buildQuery());

        // default clear makes execute() re-runnable — no double-accumulation
        expect(second).toEqual(first);
    });

    it('should accumulate across executes when clear is disabled', () => {
        const adapter = new Adapter(pg);

        adapter.execute(buildQuery());
        const fragments = adapter.execute(buildQuery(), undefined, { clear: false });

        // filter conditions (and their params) stack instead of resetting
        expect(fragments.params).toEqual([18, 'a', 18, 'a']);
    });
});

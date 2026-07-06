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
    QueryBuilder,
    Relation,
    Relations,
    Sort,
    Sorts,
} from '@rapiq/core';
import type { DialectOptions } from '../../src';
import {
    Adapter,
    QueryVisitor,
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '../../src';

const buildQuery = () => {
    const builder = new QueryBuilder();

    builder.fields = new Fields([
        new Field('id'),
        new Field('name'),
        new Field('realm.name'),
    ]);
    builder.filters = new Filters('and', [
        new Filter('gte', 'age', 18),
        new Filter('in', 'realm.id', ['a', null]),
    ]);
    builder.relations = new Relations([new Relation('realm')]);
    builder.sorts = new Sorts([new Sort('age', 'DESC')]);
    builder.pagination = new Pagination(25, 50);

    return builder.build();
};

const buildFragments = (dialect: DialectOptions) => {
    const adapter = new Adapter({ ...dialect, rootAlias: 'user' });

    buildQuery().accept(new QueryVisitor(adapter));

    return adapter.build();
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

        buildQuery().accept(new QueryVisitor(adapter));

        const fragments = adapter.build();
        expect(fragments.columns).toEqual(['"id"', '"name"', '"realm"."name"']);
        expect(fragments.where).toEqual('("age" >= $1 and ("realm"."id" in($2) or "realm"."id" is null))');
    });

    it('should drop excluded fields from the columns', () => {
        const adapter = new Adapter(pg);

        const builder = new QueryBuilder();
        builder.fields = new Fields([
            new Field('id'),
            new Field('email', '-'),
        ]);

        builder.build().accept(new QueryVisitor(adapter));

        expect(adapter.build().columns).toEqual(['"id"']);
    });

    it('should expand and dedupe relation paths', () => {
        const adapter = new Adapter(pg);

        const builder = new QueryBuilder();
        builder.relations = new Relations([
            new Relation('items.realm'),
            new Relation('items.user'),
        ]);

        builder.build().accept(new QueryVisitor(adapter));

        expect(adapter.build().relations).toEqual([
            'items',
            'items.realm',
            'items.user',
        ]);
    });

    it('should reset accumulated fragments on clear', () => {
        const adapter = new Adapter(pg);

        buildQuery().accept(new QueryVisitor(adapter));
        adapter.clear();

        expect(adapter.build()).toEqual({
            columns: [],
            where: '',
            params: [],
            orderBy: [],
            limit: undefined,
            offset: undefined,
            relations: [],
        });
    });
});

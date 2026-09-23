/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    Filter,
    FilterFieldOperator,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    defineQuery,
} from '@rapiq/core';
import type { DataSource } from 'typeorm';
import type { RelationsAdapterOptions } from '../../../src';
import { TypeormAdapter } from '../../../src';
import { Activity } from '../../data/entity/activity';
import { Reading } from '../../data/entity/reading';
import { createUnconnectedDataSource } from '../../data/factory';

const BUCKET_DAY = 'strftime(\'%Y-%m-%dT00:\' || \'00:\' || \'00.000Z\', "activity"."created_at")';

describe('src/adapter/module.ts (executeGrouped)', () => {
    let sqlite : DataSource;
    let pg : DataSource;

    beforeAll(async () => {
        sqlite = await createUnconnectedDataSource();
        pg = await createUnconnectedDataSource({
            type: 'postgres',
            database: 'test',
            entities: [Reading],
        });
    });

    const setup = (relations?: RelationsAdapterOptions) => {
        const queryBuilder = sqlite
            .getRepository(Activity)
            .createQueryBuilder('activity');

        const adapter = new TypeormAdapter({ queryBuilder, relations });

        return { queryBuilder, adapter };
    };

    it('should refuse a query without groups or aggregates', () => {
        const { adapter } = setup();

        expect(() => adapter.executeGrouped(defineQuery({})))
            .toThrowError(expect.objectContaining({
                code: ErrorCode.FEATURE_UNSUPPORTED,
                feature: 'groups:empty',
            }));
    });

    it('should select, group and order by the output keys', () => {
        const { queryBuilder, adapter } = setup();

        const output = adapter.executeGrouped(defineQuery({
            groups: [{ name: 'bucket', params: ['created_at', 'day'] }, 'scope'],
            aggregates: ['count'],
            pagination: { limit: 10, offset: 5 },
        }));

        const { expressionMap } = queryBuilder;

        expect(expressionMap.selects).toEqual([
            { selection: BUCKET_DAY, aliasName: 'bucket' },
            { selection: '"activity"."scope"', aliasName: 'scope' },
            { selection: 'count(*)', aliasName: 'count' },
        ]);
        expect(expressionMap.groupBys).toEqual([BUCKET_DAY, '"activity"."scope"']);
        expect(expressionMap.orderBys).toEqual({ bucket: 'ASC', scope: 'ASC' });
        expect(output.pagination).toEqual({ limit: 10, offset: 5 });
    });

    it('should paginate with limit and offset, never take and skip', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            pagination: { limit: 10, offset: 5 },
        }));

        expect(queryBuilder.expressionMap.limit).toEqual(10);
        expect(queryBuilder.expressionMap.offset).toEqual(5);
        expect(queryBuilder.expressionMap.take).toBeUndefined();
        expect(queryBuilder.expressionMap.skip).toBeUndefined();
    });

    it('should order by an explicit sort on an aggregate key', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            sorts: new Sorts([new Sort('count', SortDirection.DESC)]),
        }));

        expect(queryBuilder.expressionMap.orderBys).toEqual({ count: 'DESC' });
        expect(queryBuilder.getSql()).toContain('ORDER BY "count" DESC');
    });

    it('should replace caller selects and orderings', () => {
        const { queryBuilder, adapter } = setup();

        queryBuilder.select('activity.id').orderBy('activity.id', 'DESC');

        adapter.executeGrouped(defineQuery({ aggregates: ['count'] }));

        expect(queryBuilder.expressionMap.selects).toEqual([
            { selection: 'count(*)', aliasName: 'count' },
        ]);
        expect(queryBuilder.expressionMap.orderBys).toEqual({});
    });

    it('should apply filters with andWhere', () => {
        const { queryBuilder, adapter } = setup();

        queryBuilder.where('activity.amount > 0');

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            // a string operand: the sqlite driver inlines numbers.
            filters: new Filter(FilterFieldOperator.EQUAL, 'name', 'login'),
        }));

        const [sql, params] = queryBuilder.getQueryAndParameters();

        expect(sql).toContain('"activity"."amount" > 0');
        expect(sql).toContain('"activity"."name") = lower(?)');
        expect(params).toEqual(['login']);
    });

    it('should join a filtered relation without selecting it and never join an include', () => {
        const { queryBuilder, adapter } = setup({ joinAndSelect: true });

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
            relations: new Relations([new Relation('tags')]),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
        expect(queryBuilder.expressionMap.joinAttributes[0]!.relation?.propertyName).toEqual('realm');
        expect(queryBuilder.expressionMap.selects).toEqual([
            { selection: '"activity"."scope"', aliasName: 'scope' },
        ]);
    });

    it('should keep a join hook from regrouping the query', () => {
        const { queryBuilder, adapter } = setup({
            onJoin: (_path, _alias, qb) => {
                qb.addGroupBy(`${qb.alias}.id`);
            },
        });

        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
        expect(queryBuilder.expressionMap.groupBys).toEqual([]);
        expect(queryBuilder.getSql()).not.toContain('GROUP BY');
    });

    it('should refuse to bucket a column that is not temporal', () => {
        const { adapter } = setup();

        expect(() => adapter.executeGrouped(defineQuery({ groups: [{ name: 'bucket', params: ['amount', 'day'] }] }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'groups:bucket-type',
        }));
    });

    it('should normalize raw rows to the output keys', () => {
        const { adapter } = setup();

        const output = adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count', { name: 'sum', params: ['amount'] }],
        }));

        expect(output.normalize([
            {
                scope: 'auth',
                count: '3',
                sum_amount: '12',
                extra: 1,
            },
        ])).toEqual([{
            scope: 'auth',
            count: 3,
            sum_amount: 12,
        }]);
    });

    it('should refuse a sort that names no output key before touching the builder', () => {
        const { queryBuilder, adapter } = setup();

        expect(() => adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            sorts: new Sorts([new Sort('x) --', SortDirection.ASC)]),
        }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'sorts:grouped',
        }));
        expect(queryBuilder.expressionMap.orderBys).toEqual({});
    });

    it('should refuse a builder that is already grouped', () => {
        const { queryBuilder, adapter } = setup();

        queryBuilder.groupBy('activity.id');

        expect(() => adapter.executeGrouped(defineQuery({ aggregates: ['count'] })))
            .toThrowError(expect.objectContaining({
                code: ErrorCode.FEATURE_UNSUPPORTED,
                feature: 'groups:builder',
            }));
        expect(queryBuilder.expressionMap.groupBys).toEqual(['activity.id']);
    });

    it('should refuse aggregates across a to-many join the caller made', () => {
        const { queryBuilder, adapter } = setup();

        queryBuilder.leftJoin('activity.tags', 'tag');

        expect(() => adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
        }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:fan-out',
        }));
    });

    it('should refuse aggregates across a to-many relation a filter traverses', () => {
        const onJoin = vi.fn();
        const { queryBuilder, adapter } = setup({ onJoin });

        expect(() => adapter.executeGrouped(defineQuery({
            aggregates: [{ name: 'sum', params: ['amount'] }],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:fan-out',
        }));

        // refused before anything is joined: the builder stays as handed over.
        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(onJoin).not.toHaveBeenCalled();
    });

    it('should allow groups alone across a to-many join', () => {
        const { queryBuilder, adapter } = setup();

        queryBuilder.leftJoin('activity.tags', 'tag');

        adapter.executeGrouped(defineQuery({ groups: ['scope'] }));

        expect(queryBuilder.expressionMap.groupBys).toEqual(['"activity"."scope"']);
    });

    it('should allow aggregates across a to-one join', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(1);
    });

    describe('postgres column kinds', () => {
        const render = (field: string, parameters: Record<string, unknown> = {}) => {
            const queryBuilder = pg
                .getRepository(Reading)
                .createQueryBuilder('reading')
                .setParameters(parameters);

            const adapter = new TypeormAdapter({ queryBuilder });

            adapter.executeGrouped(defineQuery({
                groups: [{ name: 'bucket', params: [field, 'day'] }],
                aggregates: ['count'],
                filters: new Filter(FilterFieldOperator.EQUAL, 'value', 1),
            }));

            return queryBuilder.getQueryAndParameters();
        };

        it('should truncate a zone-aware column in UTC', () => {
            const [sql] = render('observed_at');

            expect(sql).toContain('date_trunc(\'day\', "reading"."observed_at" at time zone \'UTC\')');
        });

        it('should truncate a zone-less column as stored', () => {
            const [sql] = render('recorded_at');

            expect(sql).toContain('date_trunc(\'day\', "reading"."recorded_at")');
            expect(sql).not.toContain('"reading"."recorded_at" at time zone');
        });

        it('should cast a date-only column before truncating', () => {
            const [sql] = render('observed_on');

            expect(sql).toContain('date_trunc(\'day\', cast("reading"."observed_on" as timestamp))');
        });

        it.each(['observed_at', 'observed_on'])('should keep the %s bucket out of caller parameters named like its fragments', (field) => {
            // typeorm rewrites `:<name>` for every parameter key, inside
            // string literals too.
            const [sql, params] = render(field, {
                timestamp: 'x',
                MI: 'x',
                SS: 'x',
            });

            expect(sql).toContain('\'YYYY-MM-DD"T"HH24":"MI":"SS".000Z"\'');
            expect(sql).not.toMatch(/:(timestamp|MI|SS)\b/);
            expect(params).toEqual([1]);
        });
    });
});

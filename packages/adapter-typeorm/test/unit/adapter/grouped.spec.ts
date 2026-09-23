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
    Query,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    and,
    defineAggregates,
    defineGroups,
    defineQuery,
} from '@rapiq/core';
import { FiltersVisitor } from '@rapiq/adapter-sql';
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

    it('should refuse an output key written twice by a hand-built query', () => {
        const { queryBuilder, adapter } = setup();
        const sql = queryBuilder.getSql();

        expect(() => adapter.executeGrouped(new Query({
            groups: defineGroups(['count']),
            aggregates: defineAggregates(['count']),
        }))).toThrowError(expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }));
        expect(queryBuilder.getSql()).toEqual(sql);
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
            { selection: BUCKET_DAY, aliasName: 'bucket_created_at_day' },
            { selection: '"activity"."scope"', aliasName: 'scope' },
            { selection: 'count(*)', aliasName: 'count' },
        ]);
        expect(expressionMap.groupBys).toEqual([BUCKET_DAY, '"activity"."scope"']);
        expect(expressionMap.orderBys).toEqual({ bucket_created_at_day: 'ASC', scope: 'ASC' });
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

    it('should order by an explicit sort on an aggregate key, then by the group keys', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            sorts: new Sorts([new Sort('count', SortDirection.DESC)]),
        }));

        expect(queryBuilder.expressionMap.orderBys).toEqual({ count: 'DESC', scope: 'ASC' });
        expect(queryBuilder.getSql()).toContain('ORDER BY "count" DESC, "scope" ASC');
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

    it('should refuse a sum over a column that is not numeric before touching the builder', () => {
        const { queryBuilder, adapter } = setup();
        const sql = queryBuilder.getSql();

        expect(() => adapter.executeGrouped(defineQuery({ aggregates: [{ name: 'sum', params: ['name'] }] }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:sum-type',
        }));
        expect(queryBuilder.getSql()).toEqual(sql);
    });

    it('should sum a numeric column, a Number-typed one included', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            aggregates: [
                { name: 'sum', params: ['amount'] },
                { name: 'sum', params: ['id'] },
            ],
        }));

        expect(queryBuilder.expressionMap.selects).toEqual([
            { selection: 'sum("activity"."amount")', aliasName: 'sum_amount' },
            { selection: 'sum("activity"."id")', aliasName: 'sum_id' },
        ]);
    });

    it('should sum any column without entity metadata', () => {
        const queryBuilder = sqlite
            .createQueryBuilder()
            .select('t.label')
            .from('some_table', 't');

        new TypeormAdapter({ queryBuilder }).executeGrouped(defineQuery({ aggregates: [{ name: 'sum', params: ['label'] }] }));

        expect(queryBuilder.expressionMap.selects).toEqual([
            { selection: 'sum("t"."label")', aliasName: 'sum_label' },
        ]);
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
        const onJoin = vi.fn();
        const { queryBuilder, adapter } = setup({ onJoin });

        queryBuilder.leftJoin('activity.tags', 'tag');
        const sql = queryBuilder.getSql();

        expect(() => adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:fan-out',
        }));

        // refused before any subquery or join: the builder stays as handed over.
        expect(queryBuilder.getSql()).toEqual(sql);
        expect(onJoin).not.toHaveBeenCalled();
    });

    it('should render a filter across a to-many relation as a correlated EXISTS', () => {
        const { queryBuilder, adapter } = setup();

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: [{ name: 'sum', params: ['amount'] }],
            filters: and(
                new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
                new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
            ),
        }));

        const [sql, params] = queryBuilder.getQueryAndParameters();

        // nothing is joined on the builder itself: every join row stays
        // inside the subquery, which reaches the root row by its key.
        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(sql).toMatch(/^SELECT "activity"\."scope" AS "scope", sum\("activity"\."amount"\) AS "sum_amount" FROM "activity" "activity" WHERE EXISTS \(SELECT 1 FROM "activity" "activity_exists" /);
        expect(sql).toContain('LEFT JOIN "activity_tag" "r4_tags" ON "r4_tags"."activity_id"="activity_exists"."id"');
        expect(sql).toContain('LEFT JOIN "realm" "r5_realm" ON "r5_realm"."id"="activity_exists"."realm_id"');
        expect(sql).toContain('"activity_exists"."id" = "activity"."id"');
        expect(sql).toContain('lower("r4_tags"."name") = lower(?)');
        expect(sql).toContain('GROUP BY "activity"."scope"');
        expect(params).toEqual(['a', 'master']);
    });

    it('should render groups alone across a to-many relation as a correlated EXISTS too', () => {
        // a hydrating join inside the subquery selects nothing there either.
        const { queryBuilder, adapter } = setup({ joinAndSelect: true });

        adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }));

        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
        expect(queryBuilder.getSql()).toContain('WHERE EXISTS (SELECT 1 FROM "activity" "activity_exists" LEFT JOIN');
    });

    it('should keep conditions accumulated with clear: false on the builder beside the EXISTS', () => {
        const { queryBuilder, adapter } = setup();

        new Filter(FilterFieldOperator.EQUAL, 'name', 'login').accept(new FiltersVisitor(adapter.filters));

        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }), { clear: false });

        const [sql, params] = queryBuilder.getQueryAndParameters();

        expect(sql).toMatch(/WHERE lower\("activity"\."name"\) = lower\(\?\) AND EXISTS \(SELECT 1 FROM "activity" "activity_exists" /);
        expect(params).toEqual(['login', 'a']);
    });

    it('should run join hooks and soft-delete visibility inside the subquery', () => {
        const hooked : {
            path: string,
            alias: string,
            withDeleted: boolean,
        }[] = [];
        const { queryBuilder, adapter } = setup({
            onJoin: (path, alias, qb) => {
                hooked.push({
                    path,
                    alias: qb.alias,
                    withDeleted: qb.expressionMap.withDeleted,
                });
                qb.andWhere(`${alias}.name <> :hidden`, { hidden: 'secret' });
                // a GROUP BY or select a hook adds cannot reach the outer query.
                qb.addGroupBy(`${qb.alias}.id`).addSelect(`${alias}.id`);
            },
        });

        queryBuilder.withDeleted();

        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }));

        expect(hooked).toEqual([{
            path: 'tags',
            alias: 'activity_exists',
            withDeleted: true,
        }]);

        const [sql, params] = queryBuilder.getQueryAndParameters();

        expect(sql).toMatch(/WHERE EXISTS \(SELECT 1 FROM .* WHERE "r4_tags"\."name" <> \? AND "activity_exists"\."id" = "activity"\."id" AND /);
        expect(sql).not.toContain('GROUP BY');
        expect(params).toEqual(['secret', 'a']);
    });

    // a caller parameter under each of the fifty namespaces an adapter
    // would draw after the one it holds.
    const takeNextNamespaces = (adapter: TypeormAdapter) => {
        const drawn = Number(/rapiq_(\d+)_/.exec(adapter.filters.paramPlaceholder(1))![1]);

        const taken : Record<string, string> = {};
        for (let i = 1; i <= 50; i++) {
            taken[`rapiq_${drawn + i}_0`] = 'caller';
        }

        return taken;
    };

    it('should never draw a parameter namespace a caller parameter uses', () => {
        const { queryBuilder, adapter } = setup();
        const taken = takeNextNamespaces(adapter);
        queryBuilder.where('1 = 1').setParameters(taken);

        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'name', 'login'),
        }));

        expect(queryBuilder.getQueryAndParameters()[1]).toEqual(['login']);
        expect(queryBuilder.getParameters()).toEqual(expect.objectContaining(taken));
    });

    it('should never let the subquery draw a parameter namespace a caller parameter uses', () => {
        const { queryBuilder, adapter } = setup();
        const taken = takeNextNamespaces(adapter);
        queryBuilder.where('1 = 1').setParameters(taken);

        // clear: false keeps the namespace drawn before the caller's
        // parameters, so the subquery is the first to draw after them.
        adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a'),
        }), { clear: false });

        expect(queryBuilder.getQueryAndParameters()[1]).toEqual(['a']);
        expect(queryBuilder.getParameters()).toEqual(expect.objectContaining(taken));
    });

    it('should refuse aggregates across a to-many join accumulated under clear: false', () => {
        const { queryBuilder, adapter } = setup();

        new Filter(FilterFieldOperator.EQUAL, 'tags.name', 'a')
            .accept(new FiltersVisitor(adapter.filters));
        const sql = queryBuilder.getSql();

        expect(() => adapter.executeGrouped(defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
        }), { clear: false })).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:fan-out',
        }));

        expect(queryBuilder.getSql()).toEqual(sql);
    });

    it('should refuse aggregates across a to-many join a hook adds to the builder', () => {
        const { adapter } = setup({
            onJoin: (_path, _alias, qb) => {
                qb.leftJoin(`${qb.alias}.tags`, 'hooked');
            },
        });

        expect(() => adapter.executeGrouped(defineQuery({
            aggregates: ['count'],
            filters: new Filter(FilterFieldOperator.EQUAL, 'realm.name', 'master'),
        }))).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'aggregates:fan-out',
        }));
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

        it.each(['price', 'counts'])('should refuse a sum over the %s column', (field) => {
            // pg returns a money sum as formatted text and has no sum(integer[]).
            const adapter = new TypeormAdapter({ queryBuilder: pg.getRepository(Reading).createQueryBuilder('reading') });

            expect(() => adapter.executeGrouped(defineQuery({ aggregates: [{ name: 'sum', params: [field] }] })))
                .toThrowError(expect.objectContaining({
                    code: ErrorCode.FEATURE_UNSUPPORTED,
                    feature: 'aggregates:sum-type',
                }));
        });

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

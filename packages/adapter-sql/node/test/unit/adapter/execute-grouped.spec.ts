/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregates,
    Filter,
    Filters,
    Groups,
    Query,
    Relation,
    Relations,
} from '@rapiq/core';
import type { DialectOptions, GroupedSqlFragments } from '../../../src';
import {
    Adapter,
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '../../../src';
import {
    bucketGroup,
    buildIssueQuery,
    columnGroup,
    countAggregate,
    sumAggregate,
} from '../../data/grouped';

const PG_DAY = 'to_char(date_trunc(\'day\', "event"."createdAt"), \'YYYY-MM-DD"T"HH24":"MI":"SS".000Z"\')';
const MYSQL_DAY = 'date_format(`event`.`createdAt`, concat(\'%Y-%m-%dT00:\', \'00:\', \'00.000Z\'))';
const SQLITE_DAY = 'strftime(\'%Y-%m-%dT00:\' || \'00:\' || \'00.000Z\', `event`.`createdAt`)';

const presets : [string, DialectOptions, GroupedSqlFragments][] = [
    ['pg', pg, {
        columns: [
            `${PG_DAY} as "createdAt"`,
            '"event"."scope" as "scope"',
            '"event"."name" as "name"',
            'count(*) as "count"',
        ],
        where: '(lower("event"."realmId") in(lower($1)) or "event"."realmId" is null)',
        params: ['r1'],
        groupBy: [PG_DAY, '"event"."scope"', '"event"."name"'],
        orderBy: ['"createdAt" ASC', '"scope" ASC', '"name" ASC'],
        limit: 100,
        offset: 0,
        relations: [],
    }],
    ['mysql', mysql, {
        columns: [
            `${MYSQL_DAY} as \`createdAt\``,
            '`event`.`scope` as `scope`',
            '`event`.`name` as `name`',
            'count(*) as `count`',
        ],
        where: '(`event`.`realmId` in(?) or `event`.`realmId` is null)',
        params: ['r1'],
        groupBy: [MYSQL_DAY, '`event`.`scope`', '`event`.`name`'],
        orderBy: ['`createdAt` ASC', '`scope` ASC', '`name` ASC'],
        limit: 100,
        offset: 0,
        relations: [],
    }],
    ['sqlite', sqlite, {
        columns: [
            `${SQLITE_DAY} as \`createdAt\``,
            '`event`.`scope` as `scope`',
            '`event`.`name` as `name`',
            'count(*) as `count`',
        ],
        where: '(lower(`event`.`realmId`) in(lower(?)) or `event`.`realmId` is null)',
        params: ['r1'],
        groupBy: [SQLITE_DAY, '`event`.`scope`', '`event`.`name`'],
        orderBy: ['`createdAt` ASC', '`scope` ASC', '`name` ASC'],
        limit: 100,
        offset: 0,
        relations: [],
    }],
];

describe('src/adapter/module.ts (executeGrouped)', () => {
    it.each(presets)('should build grouped fragments for %s', (_name, dialect, expected) => {
        const adapter = new Adapter({ ...dialect, rootAlias: 'event' });

        expect(adapter.executeGrouped(buildIssueQuery())).toEqual(expected);
    });

    it.each(['hour', 'day', 'month'])('should inline the %s unit and never bind it', (unit) => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });

        const fragments = adapter.executeGrouped(buildIssueQuery(unit));

        expect(fragments.params).toEqual(['r1']);
        expect(fragments.groupBy[0]).toContain(`date_trunc('${unit}', `);
    });

    it('should keep refusing a grouped query in execute()', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });

        expect(() => adapter.execute(buildIssueQuery()))
            .toThrow('The feature groups is not supported by the dialect.');
    });

    it.each([
        ['mssql', mssql],
        ['oracle', oracle],
    ])('should refuse a bucket on %s', (_name, dialect) => {
        const adapter = new Adapter({ ...dialect, rootAlias: 'event' });

        expect(() => adapter.executeGrouped(buildIssueQuery()))
            .toThrow('The feature groups:bucket is not supported by the dialect.');
    });

    it('should group by bare columns on mssql', () => {
        const adapter = new Adapter({ ...mssql, rootAlias: 'event' });

        const fragments = adapter.executeGrouped(new Query({
            groups: new Groups([columnGroup('scope')]),
            aggregates: new Aggregates([countAggregate()]),
        }));

        expect(fragments.columns).toEqual(['[event].[scope] as [scope]', 'count(*) as [count]']);
        expect(fragments.groupBy).toEqual(['[event].[scope]']);
        expect(fragments.orderBy).toEqual(['[scope] ASC']);
    });

    it('should build one row for an aggregates-only query', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });

        const fragments = adapter.executeGrouped(new Query({ aggregates: new Aggregates([countAggregate(), sumAggregate('amount')]) }));

        expect(fragments.columns).toEqual(['count(*) as "count"', 'sum("event"."amount") as "sumAmount"']);
        expect(fragments.groupBy).toEqual([]);
        expect(fragments.orderBy).toEqual([]);
    });

    it('should join only the relations a filter traverses, never the includes', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });

        const query = new Query({
            filters: new Filters('and', [new Filter('eq', 'realm.name', 'master')]),
            relations: new Relations([new Relation('realm'), new Relation('items')]),
            groups: new Groups([columnGroup('scope')]),
            aggregates: new Aggregates([countAggregate()]),
        });

        const fragments = adapter.executeGrouped(query);
        expect(fragments.relations).toEqual(['realm']);
        expect(fragments.where).toEqual('lower("r5_realm"."name") = lower($1)');
    });

    it('should forward caseSensitive to the filters', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });

        const fragments = adapter.executeGrouped(buildIssueQuery(), { caseSensitive: ['realmId'] });

        expect(fragments.where).toEqual('("event"."realmId" in($1) or "event"."realmId" is null)');
    });

    it('should bucket a zoned column through a temporalKind assigned on the instance', () => {
        const adapter = new Adapter({ ...pg, rootAlias: 'event' });
        adapter.filters.temporalKind = (field) => (field === 'createdAt' ? 'instant' : 'datetime');

        const fragments = adapter.executeGrouped(new Query({ groups: new Groups([bucketGroup('day')]) }));

        expect(fragments.groupBy).toEqual([
            'to_char(date_trunc(\'day\', "event"."createdAt" at time zone \'UTC\'), \'YYYY-MM-DD"T"HH24":"MI":"SS".000Z"\')',
        ]);
    });
});

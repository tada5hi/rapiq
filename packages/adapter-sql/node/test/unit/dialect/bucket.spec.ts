/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BucketUnit } from '@rapiq/core';
import type { TemporalKind } from '../../../src';
import {
    mssql,
    mysql,
    oracle,
    pg,
    sqlite,
} from '../../../src';

type Unit = `${BucketUnit}`;

const PG_FORMAT = '\'YYYY-MM-DD"T"HH24":"MI":"SS".000Z"\'';

const KINDS : TemporalKind[] = ['date', 'datetime', 'instant'];

const pgCases : [Unit, TemporalKind, string][] = [
    ['hour', 'datetime', `to_char(date_trunc('hour', "t"."createdAt"), ${PG_FORMAT})`],
    ['day', 'datetime', `to_char(date_trunc('day', "t"."createdAt"), ${PG_FORMAT})`],
    ['month', 'datetime', `to_char(date_trunc('month', "t"."createdAt"), ${PG_FORMAT})`],
    ['hour', 'instant', `to_char(date_trunc('hour', "t"."createdAt" at time zone 'UTC'), ${PG_FORMAT})`],
    ['day', 'instant', `to_char(date_trunc('day', "t"."createdAt" at time zone 'UTC'), ${PG_FORMAT})`],
    ['month', 'instant', `to_char(date_trunc('month', "t"."createdAt" at time zone 'UTC'), ${PG_FORMAT})`],
    ['hour', 'date', `to_char(date_trunc('hour', cast("t"."createdAt" as timestamp)), ${PG_FORMAT})`],
    ['day', 'date', `to_char(date_trunc('day', cast("t"."createdAt" as timestamp)), ${PG_FORMAT})`],
    ['month', 'date', `to_char(date_trunc('month', cast("t"."createdAt" as timestamp)), ${PG_FORMAT})`],
];

const mysqlCases : [Unit, string][] = [
    ['hour', 'date_format(`t`.`createdAt`, concat(\'%Y-%m-%dT%H:\', \'00:\', \'00.000Z\'))'],
    ['day', 'date_format(`t`.`createdAt`, concat(\'%Y-%m-%dT00:\', \'00:\', \'00.000Z\'))'],
    ['month', 'date_format(`t`.`createdAt`, concat(\'%Y-%m-01T00:\', \'00:\', \'00.000Z\'))'],
];

const sqliteCases : [Unit, string][] = [
    ['hour', 'strftime(\'%Y-%m-%dT%H:\' || \'00:\' || \'00.000Z\', `t`.`createdAt`)'],
    ['day', 'strftime(\'%Y-%m-%dT00:\' || \'00:\' || \'00.000Z\', `t`.`createdAt`)'],
    ['month', 'strftime(\'%Y-%m-01T00:\' || \'00:\' || \'00.000Z\', `t`.`createdAt`)'],
];

describe('src/dialect/bucket.ts', () => {
    it.each(pgCases)('should render a pg %s bucket for a %s column', (unit, kind, expected) => {
        expect(pg.bucket?.('"t"."createdAt"', unit, kind)).toEqual(expected);
    });

    it.each(mysqlCases)('should render a mysql %s bucket for every column kind', (unit, expected) => {
        for (const kind of KINDS) {
            expect(mysql.bucket?.('`t`.`createdAt`', unit, kind)).toEqual(expected);
        }
    });

    it.each(sqliteCases)('should render a sqlite %s bucket for every column kind', (unit, expected) => {
        for (const kind of KINDS) {
            expect(sqlite.bucket?.('`t`.`createdAt`', unit, kind)).toEqual(expected);
        }
    });

    // typeorm rewrites every `:<name>` of a caller parameter, inside
    // string literals too, so no colon may precede an identifier char.
    it.each([
        ['pg', pg],
        ['mysql', mysql],
        ['sqlite', sqlite],
    ] as const)('should keep %s bucket colons out of a parameter pattern', (_name, dialect) => {
        for (const unit of ['hour', 'day', 'month'] as Unit[]) {
            for (const kind of KINDS) {
                expect(dialect.bucket?.('"t"."createdAt"', unit, kind)).not.toMatch(/:(\.\.\.)?[A-Za-z0-9_.]/);
            }
        }
    });

    it('should leave bucket undeclared on mssql and oracle', () => {
        expect(mssql.bucket).toBeUndefined();
        expect(oracle.bucket).toBeUndefined();
    });
});

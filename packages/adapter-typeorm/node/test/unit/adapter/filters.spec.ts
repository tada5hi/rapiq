/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    Filter,
    FilterFieldOperator,
} from '@rapiq/core';
import { FiltersVisitor } from '@rapiq/adapter-sql';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../../src';
import { User } from '../../data/entity/user';
import {
    createMysqlDataSourceOptions,
    createPostgresDataSourceOptions,
    createUnconnectedDataSource,
} from '../../data/factory';

describe('src/adapter/filters.ts', () => {
    let sqlite : DataSource;
    let mysql : DataSource;
    let pg : DataSource;

    beforeAll(async () => {
        sqlite = await createUnconnectedDataSource();
        mysql = await createUnconnectedDataSource(createMysqlDataSourceOptions());
        pg = await createUnconnectedDataSource(createPostgresDataSourceOptions());
    });

    const apply = (
        dataSource: DataSource,
        condition: Filter,
    ) : [string, unknown[]] => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter({ queryBuilder });

        condition.accept(new FiltersVisitor(adapter.filters));

        const [sql, params] = adapter.filters.getQueryAndParameters();

        // parameter names carry a per-run namespace (`:rapiq_<n>_<i>`);
        // normalize it away for stable, readable assertions.
        return [sql.replace(/:rapiq_\d+_/g, ':'), params];
    };

    it('should escape fields per dialect', () => {
        const condition = new Filter(FilterFieldOperator.EQUAL, 'age', 18);

        const [sqliteSql, sqliteParams] = apply(sqlite, condition);
        expect(sqliteSql).toEqual('"user"."age" = :0');
        expect(sqliteParams).toEqual([18]);

        const [mysqlSql, mysqlParams] = apply(mysql, condition);
        expect(mysqlSql).toEqual('`user`.`age` = :0');
        expect(mysqlParams).toEqual([18]);
    });

    it('should keep quote characters inside filter identifiers (#941)', () => {
        const condition = new Filter('eq', 'name") is not null or true or ("name', 'zz');
        for (const source of [sqlite, pg]) {
            expect(apply(source, condition)).toEqual([
                'lower("user"."name"") is not null or true or (""name") = lower(:0)',
                ['zz'],
            ]);
        }
        expect(apply(mysql, new Filter('eq', 'a`b', 'zz')))
            .toEqual(['`user`.`a``b` = :0', ['zz']]);
    });

    it('should preserve native citext matching without a text cast', () => {
        const column = pg.getMetadata(User).findColumnWithPropertyPath('first_name')!;
        const previous = column.type;
        column.type = 'citext';
        try {
            expect(apply(pg, new Filter('contains', 'first_name', 'aston')))
                .toEqual(['"user"."first_name" like :0 escape \'!\'', ['%aston%']]);
        } finally {
            column.type = previous;
        }
    });

    it('should cast numeric LIKE operands on postgres (#942)', () => {
        expect(apply(pg, new Filter('contains', 'age', '1')))
            .toEqual(['"user"."age"::text like :0 escape \'!\'', ['%1%']]);
        expect(apply(pg, new Filter('notContains', 'age', '1')))
            .toEqual(['("user"."age"::text not like :0 escape \'!\' or "user"."age" is null)', ['%1%']]);
        expect(apply(pg, new Filter('eq', 'age', '18')))
            .toEqual(['"user"."age" = :0', ['18']]);
    });

    it('should build mysql regexp conditions', () => {
        const condition = new Filter(FilterFieldOperator.REGEX, 'first_name', /^Aston/);

        const [sql, params] = apply(mysql, condition);
        expect(sql).toEqual('`user`.`first_name` regexp :0 = 1');
        expect(params).toEqual(['^Aston']);
    });

    it('should reject regexp conditions on sqlite', () => {
        const condition = new Filter(FilterFieldOperator.REGEX, 'first_name', /^Aston/);

        expect(() => apply(sqlite, condition)).toThrow(AdapterError);
    });

    it('should render anchored operators as like on sqlite', () => {
        const condition = new Filter(FilterFieldOperator.STARTS_WITH, 'first_name', 'Aston');

        const [sql, params] = apply(sqlite, condition);
        // unfolded: sqlite's like is already case-insensitive
        expect(sql).toEqual('"user"."first_name" like :0 escape \'!\'');
        expect(params).toEqual(['Aston%']);
    });

    it('should render anchored operators as like on mysql', () => {
        const condition = new Filter(FilterFieldOperator.STARTS_WITH, 'first_name', 'Aston');

        const [sql, params] = apply(mysql, condition);
        // a prefix like is index-usable where `regexp` is not;
        // unfolded because mysql's default collation is already ci
        expect(sql).toEqual('`user`.`first_name` like :0 escape \'!\'');
        expect(params).toEqual(['Aston%']);
    });

    it('should skip the fold for a non-string column', () => {
        // Metadata suppresses lower(integer); the pg text cast makes LIKE valid.
        const condition = new Filter(FilterFieldOperator.STARTS_WITH, 'realm_id', '1');

        const [sql, params] = apply(pg, condition);
        expect(sql).toEqual('"user"."realm_id"::text like :0 escape \'!\'');
        expect(params).toEqual(['1%']);
    });

    it('should fold an anchored operator on a string column on pg', () => {
        const condition = new Filter(FilterFieldOperator.CONTAINS, 'first_name', 'Aston');

        const [sql, params] = apply(pg, condition);
        expect(sql).toEqual('lower("user"."first_name") like lower(:0) escape \'!\'');
        expect(params).toEqual(['%Aston%']);
    });

    it('should render null-aware in conditions', () => {
        const condition = new Filter(FilterFieldOperator.IN, 'realm_id', [1, null]);

        const [sql, params] = apply(mysql, condition);
        expect(sql).toEqual('(`user`.`realm_id` in(:0) or `user`.`realm_id` is null)');
        expect(params).toEqual([1]);
    });
});

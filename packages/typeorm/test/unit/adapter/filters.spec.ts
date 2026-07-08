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
import { FiltersVisitor } from '@rapiq/sql';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../../src';
import { User } from '../../data/entity/user';
import {
    createMysqlDataSourceOptions,
    createUnconnectedDataSource,
} from '../../data/factory';

describe('src/adapter/filters.ts', () => {
    let sqlite : DataSource;
    let mysql : DataSource;

    beforeAll(async () => {
        sqlite = await createUnconnectedDataSource();
        mysql = await createUnconnectedDataSource(createMysqlDataSourceOptions());
    });

    const apply = (
        dataSource: DataSource,
        condition: Filter,
    ) : [string, unknown[]] => {
        const queryBuilder = dataSource
            .getRepository(User)
            .createQueryBuilder('user');

        const adapter = new TypeormAdapter();
        adapter.filters.setTarget(queryBuilder);

        condition.accept(new FiltersVisitor(adapter.filters));

        return adapter.filters.getQueryAndParameters();
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

    it('should fall back to like for anchored operators on sqlite', () => {
        const condition = new Filter(FilterFieldOperator.STARTS_WITH, 'first_name', 'Aston');

        const [sql, params] = apply(sqlite, condition);
        expect(sql).toEqual('"user"."first_name" like :0 escape \'\\\'');
        expect(params).toEqual(['Aston%']);
    });

    it('should build anchored operators as regexp on mysql', () => {
        const condition = new Filter(FilterFieldOperator.STARTS_WITH, 'first_name', 'Aston');

        const [sql, params] = apply(mysql, condition);
        expect(sql).toEqual('`user`.`first_name` regexp :0 = 1');
        expect(params).toEqual(['^Aston']);
    });

    it('should render null-aware in conditions', () => {
        const condition = new Filter(FilterFieldOperator.IN, 'realm_id', [1, null]);

        const [sql, params] = apply(mysql, condition);
        expect(sql).toEqual('(`user`.`realm_id` in(:0) or `user`.`realm_id` is null)');
        expect(params).toEqual([1]);
    });

    it('should fall back to the postgres preset without a bound query', () => {
        const adapter = new TypeormAdapter();

        const condition = new Filter(FilterFieldOperator.EQUAL, 'age', 18);
        condition.accept(new FiltersVisitor(adapter.filters));

        const [sql, params] = adapter.filters.getQueryAndParameters();
        expect(sql).toEqual('"age" = :0');
        expect(params).toEqual([18]);
    });
});

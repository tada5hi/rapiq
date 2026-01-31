/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter } from '@rapiq/core';
import {
    FiltersAdapter,
    FiltersVisitor,
    RelationsAdapter,
    mssql,
    mysql,
    oracle,
    pg,
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

    it('generates posix operator for Oracle', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            oracle,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"email" ~ $1');
        expect(params).toStrictEqual([condition.value.source]);
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

    it('throws exception for MSSQL as it does not support REGEXP', () => {
        const relationsAdapter = new RelationsAdapter();
        const adapter = new FiltersAdapter(
            relationsAdapter,
            mssql,
        );
        const visitor = new FiltersVisitor(adapter);

        const condition = new Filter('regex', 'email', /@/);

        expect(() => {
            condition.accept(visitor);
        }).toThrow(/"regexp" operator is not supported in MSSQL/);
    });
});

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    FiltersAdapter,
    FiltersInterpreter,
    RelationsAdapter,
    mssql,
    mysql,
    oracle, pg,
    regex,
} from '../../../src';

describe('regex', () => {
    const relationsAdapter = new RelationsAdapter();

    const interpreter = new FiltersInterpreter({
        interpreters: { regex },
    });

    it('generates posix operator for PostgresSQL', () => {
        const condition = new FieldCondition('regex', 'email', /@/);
        const adapter = new FiltersAdapter(
            relationsAdapter,
            pg,
        );

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"email" ~ $1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('generates posix operator for Oracle', () => {
        const condition = new FieldCondition('regex', 'email', /@/);
        const adapter = new FiltersAdapter(
            relationsAdapter,
            oracle,
        );

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"email" ~ $1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('generates call to `REGEXP` function for MySQL', () => {
        const condition = new FieldCondition('regex', 'email', /@/);
        const adapter = new FiltersAdapter(
            relationsAdapter,
            mysql,
        );

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('`email` regexp ? = 1');
        expect(params).toStrictEqual([condition.value.source]);
    });

    it('throws exception for MSSQL as it does not support REGEXP', () => {
        const condition = new FieldCondition('regex', 'email', /@/);
        const adapter = new FiltersAdapter(
            relationsAdapter,
            mssql,
        );

        expect(() => {
            interpreter.interpret(condition, adapter, {});
        }).toThrow(/"regexp" operator is not supported in MSSQL/);
    });
});

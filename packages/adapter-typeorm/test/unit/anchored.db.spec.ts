/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import type { ICondition } from '@rapiq/core';
import {
    Query,
    contains,
    endsWith,
    notContains,
    startsWith,
} from '@rapiq/core';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';

/**
 * Executing coverage for the anchored operators (#934) against a live
 * database. The CI `tests-db` matrix runs this suite on MySQL and postgres;
 * locally it runs on sqlite.
 *
 * Since #934 startsWith/endsWith/contains render as LIKE on every dialect
 * (a regex predicate is not index-usable), which means the emitted fragment
 * (`escape` clause, case fold, wildcard escaping) is engine-specific and had
 * never been executed on MySQL or postgres before: `escape '\'` alone is a
 * syntax error on MySQL under the default sql_mode.
 */
describe('anchored operators', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        await dataSource.getRepository(User).save([
            {
                first_name: 'Aston',
                last_name: 'Nel',
                age: 60,
                email: 'aston.nel@example.com',
                nickName: 'Ash',
            },
            {
                first_name: 'ASTONISH',
                last_name: 'Upper',
                age: 30,
                email: 'astonish@example.com',
                nickName: null,
            },
            {
                first_name: 'Caleb',
                last_name: 'Barrows',
                age: 18,
                email: 'caleb.barrows@example.com',
                nickName: '100%_[raw]',
            },
            {
                // the decoy: an unescaped `%`, `_` or `!` in the pattern
                // would make the Caleb filters match this row too
                first_name: 'Decoy',
                last_name: 'Wildcard',
                age: 44,
                email: 'decoy@example.com',
                nickName: '100XYZraw',
            },
        ]);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const run = async (
        condition: ICondition,
        options: { caseSensitive?: string[] | boolean } = {},
    ) : Promise<string[]> => {
        const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder })
            .execute(new Query({ filters: condition }), options);

        const entities = await queryBuilder.getMany();

        return entities.map((entity) => entity.first_name).sort();
    };

    it('should match a prefix case-insensitively', async () => {
        expect(await run(startsWith('first_name', 'aston'))).toEqual(['ASTONISH', 'Aston']);
    });

    it('should match a suffix', async () => {
        expect(await run(endsWith('email', 'example.com')))
            .toEqual(['ASTONISH', 'Aston', 'Caleb', 'Decoy']);
    });

    it('should match an infix', async () => {
        expect(await run(contains('first_name', 'ston'))).toEqual(['ASTONISH', 'Aston']);
    });

    it('should treat wildcards in the value literally', async () => {
        // `%` and `_` are escaped into the pattern, so they match
        // themselves instead of standing in for any character: without
        // the escaping, both would also match the Decoy row.
        expect(await run(contains('nickName', '100%_'))).toEqual(['Caleb']);
        expect(await run(startsWith('nickName', '100%'))).toEqual(['Caleb']);
        expect(await run(endsWith('nickName', '_[raw]'))).toEqual(['Caleb']);
        expect(await run(contains('nickName', '100XYZ'))).toEqual(['Decoy']);
    });

    it('should treat the escape character in the value literally', async () => {
        // `!` is the emitted ESCAPE character, so an unescaped one would
        // swallow the character after it and match the Decoy row.
        expect(await run(contains('email', '!'))).toEqual([]);
        expect(await run(contains('nickName', '100!XYZ'))).toEqual([]);
    });

    it('should honor the caseSensitive opt-out as far as the engine can', async () => {
        const matches = await run(startsWith('first_name', 'Aston'), { caseSensitive: ['first_name'] });

        // the opt-out removes the lower() fold, but a collation-insensitive
        // engine still matches case-insensitively: mysql's default *_ci
        // collation and sqlite's ASCII-insensitive LIKE both do. Keyed on the
        // live connection, not on DB_TYPE, so an explicit DB_TYPE=sqlite (which
        // the factory maps to better-sqlite3) lands on the right expectation.
        const caseSensitiveEngine = dataSource.options.type === 'postgres';

        expect(matches).toEqual(caseSensitiveEngine ? ['Aston'] : ['ASTONISH', 'Aston']);
    });

    it('should complement an anchored operator null-inclusively', async () => {
        // the exact complement: the null nickName row matches too.
        expect(await run(notContains('nickName', 'Ash'))).toEqual(['ASTONISH', 'Caleb', 'Decoy']);
    });
});

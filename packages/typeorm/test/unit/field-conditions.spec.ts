/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Query,
    eq,
} from '@rapiq/core';
import { applyFieldConditions } from '@rapiq/memory';
import type { DataSource } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { User } from '../data/entity/user';
import { createDataSource } from '../data/factory';
import { createUserSeed } from '../data/seeder/user';

/**
 * A `Field.condition` gates the VALUE of a column on the rows satisfying it
 * (rapiq#830). This adapter cannot express that: a selection has to stay a
 * bare `alias.property` for TypeORM to resolve it against its alias map and
 * hydrate entities, so there is no room for a `case when`. The column is
 * therefore projected for EVERY row and the gate is applied after the fetch.
 *
 * The contract is consequently FAIL-OPEN, and both halves are pinned here
 * against a live database: the gated column really does come back unredacted
 * (so nobody mistakes the parser-level gate for enforcement), and the
 * documented remedy really does redact it without dropping a row.
 */
describe('src/adapter/module.ts (field visibility gates)', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        await createUserSeed(dataSource);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    // only Aston (age 60) satisfies the gate; Caleb (age 18) does not.
    const buildFields = () => new Fields([
        new Field('id'),
        new Field('age'),
        new Field('email', undefined, eq('age', 60)),
    ]);

    const fetch = async () => {
        const queryBuilder = dataSource.getRepository(User)
            .createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder })
            .execute(new Query({ fields: buildFields() }));

        return queryBuilder.getMany();
    };

    it('should project a gated column for every row (fail-open)', async () => {
        const rows = await fetch();

        // the adapter cannot enforce the gate, so nothing is redacted yet
        expect(rows.map((row) => row.email).sort()).toEqual([
            'ashton.nel@gmail.com',
            'caleb.barrows@gmail.com',
        ]);
    });

    it('should not turn a gate into a row filter', async () => {
        const rows = await fetch();

        // a gate constrains a value, never the row set
        expect(rows).toHaveLength(2);
    });

    it('should redact only the failing rows once the gate is applied', async () => {
        const guarded = applyFieldConditions(buildFields(), await fetch());

        const byAge = (age: number) => guarded.find((row) => row.age === age);

        expect(byAge(60)?.email).toBe('ashton.nel@gmail.com');
        expect(byAge(18)).not.toHaveProperty('email');
        // redaction never removes a row
        expect(guarded).toHaveLength(2);
    });
});

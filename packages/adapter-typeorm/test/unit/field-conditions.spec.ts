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
    Relation,
    Relations,
    eq,
    ne,
} from '@rapiq/core';
import { applyFieldConditions } from '@rapiq/adapter-memory';
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
 *
 * The post-fetch gate reads its operands from the fetched entities, so the
 * adapter force-projects every column a condition references even under a
 * sparse fieldset: a missing operand would over-redact an eq-style gate and
 * let a negated gate disclose (negations match missing operands).
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

    const fetch = async (fields: Fields = buildFields()) => {
        const queryBuilder = dataSource.getRepository(User)
            .createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder })
            .execute(new Query({ fields }));

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

    // the gate reads `age`, which the sparse fieldset does not request.
    const buildSparseFields = () => new Fields([
        new Field('id'),
        new Field('email', undefined, eq('age', 60)),
    ]);

    it('should force-project the operand a gate reads', async () => {
        const rows = await fetch(buildSparseFields());

        // without the forced operand the fetched entities would lack `age`
        // and the post-fetch gate would evaluate against nothing.
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(typeof row.age).toBe('number');
        }
    });

    it('should redact exactly the failing rows under a sparse fieldset', async () => {
        const guarded = applyFieldConditions(buildSparseFields(), await fetch(buildSparseFields()));

        const byAge = (age: number) => guarded.find((row) => row.age === age);

        expect(byAge(60)?.email).toBe('ashton.nel@gmail.com');
        expect(byAge(18)).not.toHaveProperty('email');
        expect(guarded).toHaveLength(2);
    });

    it('should not re-project an operand behind an included relation (#831)', async () => {
        // the operand `realm.name` sits behind a fully-selected include: the
        // join already fetches it, so the forced operand column must be
        // dropped from the explicit select instead of duplicating the
        // output alias (which MySQL rejects, #831).
        const queryBuilder = dataSource.getRepository(User)
            .createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder }).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('email', undefined, eq('realm.name', 'Master')),
            ]),
            relations: new Relations([new Relation('realm')]),
        }));

        const aliases = [...queryBuilder.getSql().matchAll(/AS\s+"([^"]+)"/g)]
            .map((match) => match[1]);
        const duplicates = aliases.filter(
            (alias, index) => aliases.indexOf(alias) !== index,
        );
        expect(duplicates).toEqual([]);

        // the row set itself stays untouched
        expect(await queryBuilder.getMany()).toHaveLength(2);
    });

    it('should keep a forced operand selected under a narrowed include (#847)', async () => {
        // `realm.id` is a direct pick, so the include narrows to the fieldset
        // instead of full-selecting the join. The gate operand `realm.name`
        // must ride along in the per-column select — it is what keeps the
        // post-fetch gate honest — while never widening the narrowing back up.
        const queryBuilder = dataSource.getRepository(User)
            .createQueryBuilder('user');

        new TypeormAdapter({ queryBuilder }).execute(new Query({
            fields: new Fields([
                new Field('id'),
                new Field('realm.id'),
                new Field('email', undefined, eq('realm.name', 'Master')),
            ]),
            relations: new Relations([new Relation('realm')]),
        }));

        const alias = queryBuilder.expressionMap.joinAttributes[0].alias.name;
        const selections = queryBuilder.expressionMap.selects
            .map((select) => select.selection);
        expect(selections).toContain(`${alias}.id`);
        expect(selections).toContain(`${alias}.name`);
        expect(selections).not.toContain(alias);

        const aliases = [...queryBuilder.getSql().matchAll(/AS\s+"([^"]+)"/g)]
            .map((match) => match[1]);
        const duplicates = aliases.filter(
            (alias, index) => aliases.indexOf(alias) !== index,
        );
        expect(duplicates).toEqual([]);

        expect(await queryBuilder.getMany()).toHaveLength(2);
    });

    it('should keep a negated sparse gate from disclosing', async () => {
        // a negated gate MATCHES a missing operand (complement law): with the
        // operand dropped from the fetch, EVERY row would keep `email`.
        const fields = new Fields([
            new Field('id'),
            new Field('email', undefined, ne('age', 60)),
        ]);

        const guarded = applyFieldConditions(fields, await fetch(fields));

        const byAge = (age: number) => guarded.find((row) => row.age === age);

        expect(byAge(18)?.email).toBe('caleb.barrows@gmail.com');
        expect(byAge(60)).not.toHaveProperty('email');
        expect(guarded).toHaveLength(2);
    });
});

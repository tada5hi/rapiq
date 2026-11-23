/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IQuery, ObjectLiteral } from '@rapiq/core';
import {
    and,
    defineQuery,
    eq,
    inArray,
    not,
    or,
} from '@rapiq/core';
import { FiltersVisitor } from '@rapiq/adapter-sql';
import { applyQuery } from '@rapiq/adapter-memory';
import type { DataSource, SelectQueryBuilder } from 'typeorm';
import { TypeormAdapter } from '../../src';
import { Activity, ActivityTag } from '../data/entity/activity';
import { createDataSource } from '../data/factory';
import { createRealmSeed } from '../data/seeder/realm';

type Seed = {
    name: string,
    amount: number,
    tags: string[],
    inMaster: boolean,
};

/**
 * `first` carries two tags, so a join on `tags` repeats it once per
 * matching tag; `none` has no tag at all, the row a negation must keep.
 */
const SEED : Seed[] = [
    {
        name: 'first',
        amount: 1,
        tags: ['a', 'b'],
        inMaster: true,
    },
    {
        name: 'second',
        amount: 2,
        tags: ['a'],
        inMaster: false,
    },
    {
        name: 'third',
        amount: 3,
        tags: ['c'],
        inMaster: true,
    },
    {
        name: 'none',
        amount: 0,
        tags: [],
        inMaster: false,
    },
];

describe('src/adapter/module.ts (to-many filters as EXISTS, rapiq#1006)', () => {
    let dataSource : DataSource;
    let records : ObjectLiteral[];
    let tagCount : Record<string, number>;

    beforeAll(async () => {
        dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const [master] = await createRealmSeed(dataSource);

        const repository = dataSource.getRepository(Activity);
        const saved = await repository.save(SEED.map((row) => repository.create({
            name: row.name,
            amount: row.amount,
            realm_id: row.inMaster ? master!.id : null,
        })));

        await dataSource.getRepository(ActivityTag).save(SEED.flatMap(
            (row, index) => row.tags.map((name) => ({ name, activity_id: saved[index]!.id })),
        ));

        records = SEED.map((row, index) => ({
            id: saved[index]!.id,
            name: row.name,
            amount: row.amount,
            realm: row.inMaster ? { name: 'master' } : null,
            tags: row.tags.map((name) => ({ name })),
        }));

        tagCount = Object.fromEntries(SEED.map((row) => [row.name, row.tags.length]));
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const build = () => dataSource.getRepository(Activity).createQueryBuilder('activity');

    const apply = (query: IQuery, queryBuilder: SelectQueryBuilder<Activity> = build()) => {
        const adapter = new TypeormAdapter({ queryBuilder });

        adapter.execute(query);

        return queryBuilder;
    };

    const names = (rows: { name: string }[]) => rows.map((row) => row.name);

    const expected = (condition: ICondition) => names(
        applyQuery(defineQuery({ filters: condition, sorts: ['id'] }), records).data as { name: string }[],
    );

    it('should keep every included row of a parent the filter selects', async () => {
        const queryBuilder = apply(defineQuery<ObjectLiteral>({
            filters: eq('tags.name', 'a'),
            relations: ['tags'],
            sorts: ['id'],
        }));

        const rows = await queryBuilder.getMany();

        expect(names(rows)).toEqual(['first', 'second']);

        for (const row of rows) {
            expect(row.tags).toHaveLength(tagCount[row.name]!);
        }

        expect(queryBuilder.getQuery()).toMatch(/EXISTS/);
    });

    it('should select the same parents without the include', async () => {
        const queryBuilder = apply(defineQuery<ObjectLiteral>({
            filters: eq('tags.name', 'a'),
            sorts: ['id'],
        }));

        const raw = await queryBuilder.getRawMany();

        expect(raw.map((row) => row.activity_name)).toEqual(['first', 'second']);
        expect(queryBuilder.expressionMap.joinAttributes).toHaveLength(0);
    });

    const PARITY : { label: string, condition: ICondition }[] = [
        { label: 'eq', condition: eq('tags.name', 'a') },
        { label: 'in over two tags of one parent', condition: inArray('tags.name', ['a', 'b']) },
        { label: 'not (null-inclusive complement)', condition: not(eq('tags.name', 'a')) },
        { label: 'or across a to-many and a root column', condition: or(eq('tags.name', 'c'), eq('name', 'second')) },
        { label: 'and with a to-one leaf', condition: and(eq('tags.name', 'a'), eq('realm.name', 'master')) },
        { label: 'two leaves on the same to-many element', condition: and(eq('tags.name', 'a'), eq('tags.name', 'b')) },
    ];

    it.each(PARITY)('should agree with adapter-memory: $label', async ({ condition }) => {
        const rows = await apply(defineQuery({
            filters: condition,
            sorts: ['id'],
            relations: ['tags'],
        })).getMany();

        expect(names(rows)).toEqual(expected(condition));

        for (const row of rows) {
            expect(row.tags).toHaveLength(tagCount[row.name]!);
        }
    });

    it('should count parent rows under pagination', async () => {
        const condition = inArray('tags.name', ['a', 'b', 'c']);

        for (const relations of [[], ['tags']]) {
            const rows = await apply(defineQuery<ObjectLiteral>({
                filters: condition,
                relations,
                sorts: ['id'],
                pagination: { limit: 1, offset: 1 },
            })).getMany();

            expect(names(rows)).toEqual(['second']);
        }
    });

    it('should still join a relation a sort and the fields read', async () => {
        const queryBuilder = apply(defineQuery<ObjectLiteral>({
            fields: ['id', 'name', 'tags.id', 'tags.name'],
            filters: eq('tags.name', 'a'),
            relations: ['tags'],
            sorts: ['id', 'tags.name'],
        }));

        const rows = await queryBuilder.getMany();

        expect(names(rows)).toEqual(['first', 'second']);
        expect(rows[0]!.tags.map((tag) => tag.name)).toEqual(['a', 'b']);
        expect(queryBuilder.getQuery()).toMatch(/EXISTS/);
    });

    it('should keep a predicate the caller put on the builder', async () => {
        const queryBuilder = build().where('activity.amount > :min', { min: 1 });

        const rows = await apply(defineQuery<ObjectLiteral>({
            filters: eq('tags.name', 'a'),
            sorts: ['id'],
        }), queryBuilder).getMany();

        expect(names(rows)).toEqual(['second']);
    });

    it('should apply filters accumulated before an execute with clear: false', async () => {
        const queryBuilder = build();
        const adapter = new TypeormAdapter({ queryBuilder });

        eq('realm.name', 'master').accept(new FiltersVisitor(adapter.filters));

        adapter.execute(defineQuery<ObjectLiteral>({
            filters: eq('tags.name', 'a'),
            sorts: ['id'],
        }), { clear: false });

        expect(names(await queryBuilder.getMany())).toEqual(['first']);
    });

    it('should keep a to-one filter a plain join', async () => {
        const queryBuilder = apply(defineQuery<ObjectLiteral>({
            filters: eq('realm.name', 'master'),
            sorts: ['id'],
        }));

        expect(queryBuilder.getQuery()).not.toMatch(/EXISTS/);
        expect(names(await queryBuilder.getMany())).toEqual(['first', 'third']);
    });
});

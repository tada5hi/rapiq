/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

/* eslint-disable max-classes-per-file */
import type { DataSource } from 'typeorm';
import {
    Column, 
    DataSource as DataSourceCtor, 
    Entity, 
    JoinColumn, 
    ManyToOne, 
    PrimaryGeneratedColumn,
} from 'typeorm';
import {
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Query,
    Relation,
    Relations,
    SchemaRegistry,
    defineSchema,
} from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import { TypeormAdapter } from '../../src';

@Entity()
class HPet {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;
}

@Entity()
class HChild {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ type: 'simple-json', nullable: true })
    args: { k: string }[] | null;

    @Column({ nullable: true })
    pet_id: number | null;

    @ManyToOne(() => HPet, { nullable: true })
    @JoinColumn({ name: 'pet_id' })
    pet: HPet;
}

@Entity()
class HParent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ type: 'simple-json', nullable: true })
    data: { k: string }[] | null;

    @Column({ nullable: true })
    child_id: number | null;

    @ManyToOne(() => HChild, { nullable: true })
    @JoinColumn({ name: 'child_id' })
    child: HChild;
}

/**
 * Regression coverage for #824: a relation `include`d without `joinAndSelect`
 * and without projected child fields must still hydrate, and json/array
 * columns must project through the Fields IR.
 */
describe('src/adapter/relations (hydration)', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = new DataSourceCtor({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [HParent, HChild, HPet],
        });
        await dataSource.initialize();
        await dataSource.synchronize();

        const pet = await dataSource.getRepository(HPet).save({ name: 'rex' });
        const child = await dataSource.getRepository(HChild).save({
            name: 'c',
            args: [{ k: 'a' }],
            pet_id: (pet as any).id,
        });
        await dataSource.getRepository(HParent).save({
            name: 'p',
            data: [{ k: 'b' }],
            child_id: (child as any).id,
        });
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const run = (query: Query, relationOpts: any = {}) => {
        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({ queryBuilder, relations: relationOpts }).execute(query);

        return queryBuilder.getOneOrFail();
    };

    it('should hydrate an included relation without joinAndSelect and without child fields', async () => {
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('name')]),
            relations: new Relations([new Relation('child')]),
        }));

        expect(parent.child).toBeDefined();
        // full hydration -> json column comes through too
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });

    it('should hydrate an included relation without any root projection', async () => {
        const parent = await run(new Query({ relations: new Relations([new Relation('child')]) }));

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        // the root stays fully selected
        expect(parent.data).toEqual([{ k: 'b' }]);
    });

    it('should widen an included relation to the whole subtree even with a projected child field', async () => {
        // @rapiq/memory contract: an included relation contributes ALL its
        // columns; a sparse `child.name` never narrows an included relation.
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('child.name')]),
            relations: new Relations([new Relation('child')]),
        }));

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });

    it('should keep a relation sparse when a field traverses it WITHOUT an include', async () => {
        // no `relations` include: `child.name` only joins-for-projection, so the
        // relation is materialized sparsely (just the referenced column).
        const parent = await run(new Query({ fields: new Fields([new Field('id'), new Field('child.name')]) }));

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        expect(parent.child.args).toBeUndefined();
    });

    it('should hydrate a nested include without joinAndSelect', async () => {
        const parent = await run(new Query({ relations: new Relations([new Relation('child.pet')]) }));

        expect(parent.child).toBeDefined();
        expect(parent.child.pet).toBeDefined();
        expect(parent.child.pet.name).toEqual('rex');
    });

    it('should hydrate a nested include while a filter joins another branch', async () => {
        const parent = await run(new Query({
            relations: new Relations([new Relation('child.pet')]),
            filters: new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'child.name', 'c'),
            ]),
        }));

        expect(parent.child).toBeDefined();
        expect(parent.child.pet.name).toEqual('rex');
    });

    it('should hydrate with joinAndSelect (regression guard)', async () => {
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('name')]),
            relations: new Relations([new Relation('child')]),
        }), { joinAndSelect: true });

        expect(parent.child).toBeDefined();
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });

    it('should NOT hydrate a relation joined only for a filter', async () => {
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('name')]),
            filters: new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'child.name', 'c'),
            ]),
        }));

        // the relation is joined for the WHERE clause but never requested,
        // so it must not appear in the result
        expect(parent.child).toBeUndefined();
    });

    it('should project a json/array column placed in the Fields IR', async () => {
        const parent = await run(new Query({ fields: new Fields([new Field('id'), new Field('data')]) }));

        expect(parent.data).toEqual([{ k: 'b' }]);
    });

    it('should drop a json/array column omitted from an explicit projection', async () => {
        const parent = await run(new Query({ fields: new Fields([new Field('id'), new Field('name')]) }));

        expect(parent.data).toBeUndefined();
    });

    it('should allow listing a concrete-typed json column in a schema fields block', () => {
        // #824 G2: a json column typed as a concrete array/object shape is now
        // a valid `fields` key (widened from SimpleKeys to FieldKeys).
        const schema = defineSchema<HParent>({
            name: 'parent',
            fields: { default: ['id', 'name', 'data'] },
        });

        expect(schema.fields.default).toEqual(['id', 'name', 'data']);
    });

    it('should hydrate an included relation id-only with hydrationMode: key', async () => {
        // #828 escape: the relation is defined, but only its primary key is
        // selected — the whole-subtree columns (name/args) stay unhydrated so
        // the relation survives GROUP BY <root>.id on strict dialects.
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('name')]),
            relations: new Relations([new Relation('child')]),
        }), { hydrationMode: 'key' });

        expect(parent.child).toBeDefined();
        expect(parent.child.id).toBeDefined();
        expect(parent.child.name).toBeUndefined();
        expect(parent.child.args).toBeUndefined();
    });

    it('should keep a projected relation column under hydrationMode: key', async () => {
        // reconciliation guard between #831 and #828/#832: a 'key'-mode relation
        // is a plain leftJoin that does NOT auto-select its columns, so a sparse
        // `child.name` field must STAY projected. The #831 drop applies only to
        // 'full' mode, where leftJoinAndSelect already emits every column — if it
        // keyed on `shouldSelect` (true for both modes) it would wrongly strip
        // this column and hydrate the relation without its requested field.
        const parent = await run(new Query({
            fields: new Fields([new Field('id'), new Field('child.name')]),
            relations: new Relations([new Relation('child')]),
        }), { hydrationMode: 'key' });

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');    // sparse column kept
        expect(parent.child.args).toBeUndefined(); // otherwise still id-only
    });

    it('should emit a plain leftJoin selecting only the key under hydrationMode: key', () => {
        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({ queryBuilder, relations: { hydrationMode: 'key' } })
            .execute(new Query({ relations: new Relations([new Relation('child')]) }));

        const sql = queryBuilder.getQuery();
        const alias = queryBuilder.expressionMap.joinAttributes[0].alias.name;

        // the child's key is selected, but its other columns are not
        expect(sql).toContain(`"${alias}"."id"`);
        expect(sql).not.toContain(`"${alias}"."name"`);
        expect(sql).not.toContain(`"${alias}"."args"`);
    });

    it('should not re-select the key when a field already names it under hydrationMode: key', async () => {
        // relations run after fields, so a `child.id` field path already selects
        // the key the id-only mode would add. The guard must not add it a second
        // time (otherwise the adapter multiplies duplicate SELECT columns).
        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({ queryBuilder, relations: { hydrationMode: 'key' } })
            .execute(new Query({
                fields: new Fields([new Field('id'), new Field('child.id')]),
                relations: new Relations([new Relation('child')]),
            }));

        const alias = queryBuilder.expressionMap.joinAttributes[0].alias.name;
        const keySelects = queryBuilder.expressionMap.selects
            .filter((select) => select.selection === `${alias}.id`);

        // the adapter contributes exactly one key selection — the field's — and
        // does not stack another on top
        expect(keySelects).toHaveLength(1);

        const parent = await queryBuilder.getOneOrFail();
        expect(parent.child.id).toBeDefined();
    });

    it('should hydrate a nested include id-only with hydrationMode: key', async () => {
        const parent = await run(
            new Query({ relations: new Relations([new Relation('child.pet')]) }),
            { hydrationMode: 'key' },
        );

        expect(parent.child).toBeDefined();
        expect(parent.child.id).toBeDefined();
        expect(parent.child.name).toBeUndefined();
        expect(parent.child.pet).toBeDefined();
        expect(parent.child.pet.id).toBeDefined();
        expect(parent.child.pet.name).toBeUndefined();
    });

    it('should keep an id-only include defined under GROUP BY <root>.id', async () => {
        // the motivating case (#828): grouped-root pagination + include. With the
        // full subtree, postgres rejects the joined columns; id-only keeps the
        // relation defined and every selected join column groupable.
        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({
            queryBuilder,
            relations: {
                hydrationMode: 'key',
                onJoin: (_path, alias, qb) => qb.addGroupBy(`${alias}.id`),
            },
        }).execute(new Query({ relations: new Relations([new Relation('child')]) }));
        queryBuilder.addGroupBy('parent.id');

        const parent = await queryBuilder.getOneOrFail();

        expect(parent.child).toBeDefined();
        expect(parent.child.id).toBeDefined();
        expect(parent.child.name).toBeUndefined();
    });

    it('should hydrate the whole subtree with hydrationMode: full (default)', async () => {
        const parent = await run(
            new Query({ relations: new Relations([new Relation('child')]) }),
            { hydrationMode: 'full' },
        );

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });

    it('should project an included relation exactly once (no duplicate output alias)', async () => {
        // Regression for #831: a schema with an explicit root `fields.default`
        // (authup junction pattern) + an `include` used to project the joined
        // relation TWICE — once via the schema-projected child fields in the
        // explicit `select()`, once via `leftJoinAndSelect`'s full-entity
        // expansion. MySQL rejects the duplicate output alias; sqlite/pg tolerate
        // it, so this asserts on the generated SQL directly.
        const registry = new SchemaRegistry();
        registry.add(defineSchema<HChild>({ name: 'child', fields: { default: ['id', 'name'] } }));
        registry.add(defineSchema<HParent>({
            name: 'parent',
            fields: { default: ['id', 'name'] },
            relations: { allowed: ['child'] },
            schemaMapping: { child: 'child' },
        }));

        const query = new SimpleParser(registry).parse(
            { relations: ['child'] },
            { schema: 'parent' },
        );

        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({ queryBuilder }).execute(query);

        const aliases = [...queryBuilder.getSql().matchAll(/AS\s+"([^"]+)"/g)].map((m) => m[1]);
        const duplicates = aliases.filter((alias, index) => aliases.indexOf(alias) !== index);
        expect(duplicates).toEqual([]);

        // the include still hydrates as a whole subtree (the json column comes through)
        const parent = await queryBuilder.getOneOrFail();
        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });

    it('should hydrate an include end-to-end when the target schema has no fields block', async () => {
        // mirrors the downstream crash (authup #3313 / FLAME Hub): a schema used
        // purely as an `include` target with no `fields` declaration, consumed
        // without `joinAndSelect` — the relation used to come back undefined.
        const registry = new SchemaRegistry();
        registry.add(defineSchema<HChild>({ name: 'child' }));
        registry.add(defineSchema<HParent>({
            name: 'parent',
            relations: { allowed: ['child'] },
            schemaMapping: { child: 'child' },
        }));

        const query = new SimpleParser(registry).parse(
            { relations: ['child'] },
            { schema: 'parent' },
        );

        const queryBuilder = dataSource.getRepository(HParent).createQueryBuilder('parent');
        new TypeormAdapter({ queryBuilder }).execute(query);
        const parent = await queryBuilder.getOneOrFail();

        expect(parent.child).toBeDefined();
        expect(parent.child.name).toEqual('c');
        expect(parent.child.args).toEqual([{ k: 'a' }]);
    });
});

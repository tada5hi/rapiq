/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { SimpleParser } from '@rapiq/parser-simple';
import type { DataSource } from 'typeorm';
import {
    Column, 
    Entity, 
    ManyToOne, 
    PrimaryGeneratedColumn,
} from 'typeorm';
import {
    buildEntitySchemaName,
    defineSchemaRegistryWithDataSource,
    defineSchemaWithEntity,
} from '../../../src';
import { createDataSourceOptions, createUnconnectedDataSource } from '../../data/factory';
import { Realm } from '../../data/entity/realm';
import { RoleDetail } from '../../data/entity/role-detail';
import { User } from '../../data/entity/user';

@Entity()
class Article {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ select: false })
    secret: string;

    @ManyToOne(() => Realm)
    owner: Realm;
}

describe('src/schema/*.ts', () => {
    let dataSource : DataSource;
    let articleDataSource : DataSource;

    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();

        const options = createDataSourceOptions();
        articleDataSource = await createUnconnectedDataSource({
            ...options,
            entities: [Article, Realm],
        });
    });

    it('should derive lower-camel schema names', () => {
        expect(buildEntitySchemaName('RoleDetail')).toEqual('roleDetail');
        expect(buildEntitySchemaName('HTTPRequestLog')).toEqual('httpRequestLog');
        expect(buildEntitySchemaName('Role_Detail')).toEqual('roleDetail');
        expect(buildEntitySchemaName(dataSource.getMetadata(RoleDetail))).toEqual('roleDetail');

        const schema = defineSchemaWithEntity(RoleDetail, dataSource);
        expect(schema.name).toEqual('roleDetail');
    });

    it('should derive structure (relations + schemaMapping) by default', () => {
        const schema = defineSchemaWithEntity(User, dataSource);

        expect(schema.name).toEqual('user');
        expect(schema.relations.allowed).toEqual(['role', 'realm']);
        expect(schema.mapSchema('role')).toEqual('role');
        expect(schema.mapSchema('realm')).toEqual('realm');

        expect(schema.filters.allowedIsUndefined).toBeTruthy();
        expect(schema.strict).toBeUndefined();
    });

    it('should accept entity metadata as input', () => {
        const schema = defineSchemaWithEntity(dataSource.getMetadata(User));

        expect(schema.name).toEqual('user');
    });

    it('should derive column allow-lists on opt-in', () => {
        const schema = defineSchemaWithEntity(User, dataSource, {
            filters: { allowed: 'inherit' },
            sort: { allowed: 'inherit' },
        });

        expect(schema.filters.allowed).toContain('id');
        expect(schema.filters.allowed).toContain('email');
        // explicitly declared fk columns are part of the derived list
        expect(schema.filters.allowed).toContain('realm_id');

        expect(schema.sort.allowed).toEqual(schema.filters.allowed);

        // fields were not opted in
        expect(schema.fields.allowedIsUndefined).toBeTruthy();
    });

    it('should exclude hidden and virtual join columns from derived lists', () => {
        const schema = defineSchemaWithEntity(Article, articleDataSource, { filters: { allowed: 'inherit' } });

        expect(schema.filters.allowed).toEqual(['id', 'title']);
    });

    it('should prioritize explicit options over derived values', () => {
        const schema = defineSchemaWithEntity(User, dataSource, {
            name: 'account',
            strict: true,
            schemaMapping: { realm: 'customRealm' },
            filters: { allowed: ['id'] },
            relations: { allowed: ['realm'] },
        });

        expect(schema.name).toEqual('account');
        expect(schema.strict).toBeTruthy();
        expect(schema.filters.allowed).toEqual(['id']);
        expect(schema.relations.allowed).toEqual(['realm']);
        expect(schema.mapSchema('realm')).toEqual('customRealm');
        expect(schema.mapSchema('role')).toEqual('role');
    });

    it('should build a registry for all data source entities', () => {
        const registry = defineSchemaRegistryWithDataSource(dataSource);

        expect(registry.get('user')).toBeDefined();
        expect(registry.get('role')).toBeDefined();
        expect(registry.get('roleDetail')).toBeDefined();
        expect(registry.get('realm')).toBeDefined();
    });

    it('should resolve relation traversal across derived schemas', () => {
        const registry = defineSchemaRegistryWithDataSource(dataSource);
        const parser = new SimpleParser(registry);

        // "detail" resolves to the "roleDetail" schema via the derived schemaMapping
        const output = parser.parse({ relations: ['role.detail'] }, { schema: 'user' });

        expect(output.relations.value.map((relation) => relation.name)).toEqual(['role', 'role.detail']);
    });

    it('should apply per-entity options keyed by schema name', () => {
        const registry = defineSchemaRegistryWithDataSource(dataSource, { schemas: { user: { filters: { allowed: 'inherit' } } } });

        const schema = registry.getOrFail('user');
        expect(schema.filters.allowed).toContain('email');

        const roleSchema = registry.getOrFail('role');
        expect(roleSchema.filters.allowedIsUndefined).toBeTruthy();
    });

    it('should apply per-entity options keyed by entity class', () => {
        const registry = defineSchemaRegistryWithDataSource(dataSource, {
            schemas: new Map([
                [User, { filters: { allowed: 'inherit' as const } }],
            ]),
        });

        const schema = registry.getOrFail('user');
        expect(schema.filters.allowed).toContain('email');
    });

    it('should extend an existing registry', () => {
        const registry = new SchemaRegistry();
        const realmSchema = defineSchema<Realm>({
            name: 'realm',
            filters: { allowed: ['id'] },
        });
        registry.add(realmSchema);

        const output = defineSchemaRegistryWithDataSource(dataSource, { registry });

        expect(output).toBe(registry);
        expect(registry.get('user')).toBeDefined();
        expect(registry.get('roleDetail')).toBeDefined();

        // the hand-written schema takes precedence over derivation
        expect(registry.get('realm')).toBe(realmSchema);
    });

    it('should fail on schema options for an already registered schema', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({ name: 'realm' }));

        expect(() => defineSchemaRegistryWithDataSource(dataSource, {
            registry,
            schemas: { realm: {} },
        })).toThrow('already registered');
    });

    it('should fail on schema options for an unknown entity', () => {
        expect(() => defineSchemaRegistryWithDataSource(dataSource, { schemas: { unknownEntity: {} } })).toThrow('unknownEntity');
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaOptions } from '@rapiq/core';
import { and, defineSchema, eq } from '@rapiq/core';
import type { DataSource } from 'typeorm';
import {
    SchemaEntityMismatchError,
    assertSchemaMatchesEntity,
} from '../../../src';
import { createUnconnectedDataSource } from '../../data/factory';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';

function grabError(fn: () => void) : SchemaEntityMismatchError {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(SchemaEntityMismatchError);
        return e as SchemaEntityMismatchError;
    }

    throw new Error('Expected a SchemaEntityMismatchError to be thrown.');
}

describe('src/schema/assert.ts', () => {
    let dataSource : DataSource;

    // metadata-only DataSource (unconnected) — validation reads the
    // entity metadata, never the tables.
    beforeAll(async () => {
        dataSource = await createUnconnectedDataSource();
    });

    it('should accept a schema matching the entity', () => {
        const schema = defineSchema({
            name: 'user',
            fields: {
                default: ['id', 'email'],
                allowed: ['id', 'email', 'age', 'profile.firstName'],
            },
            filters: {
                allowed: ['id', 'email', 'realm_id'],
                default: and(eq('age', 18), eq('realm.name', 'master')),
            },
            sort: {
                allowed: ['id', 'first_name'],
                default: { id: 'DESC' },
            },
            relations: { allowed: ['realm', 'role'] },
        });

        expect(() => assertSchemaMatchesEntity(schema, dataSource.getMetadata(User)))
            .not.toThrow();
    });

    it('should collect a dead column key of each parameter', () => {
        const check = (options: SchemaOptions, key: string) => {
            const schema = defineSchema({ name: 'user', ...options });
            const error = grabError(() => assertSchemaMatchesEntity(
                schema,
                dataSource.getMetadata(User),
            ));
            expect(error.keys).toEqual([key]);
        };

        check({ fields: { default: ['renamedAway'] } }, 'renamedAway');
        check({ fields: { allowed: ['renamedAway'] } }, 'renamedAway');
        check({ filters: { allowed: ['renamedAway'] } }, 'renamedAway');
        check({ sort: { allowed: ['renamedAway'] } }, 'renamedAway');
    });

    it('should accept dotted keys headed by a relation and reject others', () => {
        const valid = defineSchema({
            name: 'valid',
            sort: { allowed: ['realm.name'] },
            filters: { allowed: ['role.detail'] },
        });
        expect(() => assertSchemaMatchesEntity(valid, dataSource.getMetadata(User)))
            .not.toThrow();

        const invalid = defineSchema({
            name: 'invalid',
            sort: { allowed: ['unknownRelation.name'] },
        });
        expect(grabError(() => assertSchemaMatchesEntity(invalid, dataSource.getMetadata(User))).keys)
            .toEqual(['unknownRelation.name']);
    });

    it('should accept embedded column paths and reject embedded drift', () => {
        const valid = defineSchema({
            name: 'embedded-valid',
            fields: { allowed: ['profile.firstName', 'profile.lastName'] },
        });
        expect(() => assertSchemaMatchesEntity(valid, dataSource.getMetadata(User)))
            .not.toThrow();

        // `profile` is an embedded, not a relation — a dead key
        // inside it must not pass as a relation-headed path.
        const invalid = defineSchema({
            name: 'embedded-invalid',
            fields: { allowed: ['profile.renamedAway'] },
        });
        expect(grabError(() => assertSchemaMatchesEntity(invalid, dataSource.getMetadata(User))).keys)
            .toEqual(['profile.renamedAway']);
    });

    it('should accept relation property names in the relations allow-list only', () => {
        const valid = defineSchema({
            name: 'relations-valid',
            relations: { allowed: ['realm', 'role.detail'] },
        });
        expect(() => assertSchemaMatchesEntity(valid, dataSource.getMetadata(User)))
            .not.toThrow();

        // a column is not joinable ...
        const column = defineSchema({
            name: 'relation-as-column',
            relations: { allowed: ['email'] },
        });
        expect(grabError(() => assertSchemaMatchesEntity(column, dataSource.getMetadata(User))).keys)
            .toEqual(['email']);

        // ... and a relation is not a field.
        const field = defineSchema({
            name: 'column-as-relation',
            fields: { allowed: ['realm'] },
        });
        expect(grabError(() => assertSchemaMatchesEntity(field, dataSource.getMetadata(User))).keys)
            .toEqual(['realm']);
    });

    it('should validate the leaf fields of a filters default condition tree', () => {
        const schema = defineSchema({
            name: 'filters-default',
            filters: { default: and(eq('name', 'admin'), eq('renamedAway', 'x')) },
        });

        expect(grabError(() => assertSchemaMatchesEntity(schema, dataSource.getMetadata(Role))).keys)
            .toEqual(['renamedAway']);
    });

    it('should validate sort default keys and flatten tuple groups', () => {
        const schema = defineSchema({
            name: 'sort',
            sort: {
                allowed: [['first_name', 'last_name'], ['renamedAway']],
                default: { deadDefault: 'DESC' },
            },
        });

        expect(grabError(() => assertSchemaMatchesEntity(schema, dataSource.getMetadata(User))).keys)
            .toEqual(['renamedAway', 'deadDefault']);
    });

    it('should aggregate offending keys across parameters', () => {
        const schema = defineSchema({
            name: 'drifted',
            fields: { allowed: ['id', 'deadField'] },
            filters: { allowed: ['email', 'deadFilter'] },
            sort: { allowed: ['deadSort'] },
            relations: { allowed: ['realm', 'deadRelation'] },
        });

        const error = grabError(() => assertSchemaMatchesEntity(
            schema,
            dataSource.getMetadata(User),
        ));

        expect(error.schema).toEqual('drifted');
        expect(error.entity).toEqual('User');
        expect(error.keys).toEqual(['deadField', 'deadFilter', 'deadSort', 'deadRelation']);
        expect(error.code).toEqual('schemaEntityMismatch');
        expect(error.message).toContain('drifted');
        expect(error.message).toContain('deadField, deadFilter, deadSort, deadRelation');
    });

    it('should resolve the metadata of an entity target', () => {
        const valid = defineSchema({
            name: 'target-valid',
            filters: { allowed: ['email'] },
        });
        expect(() => assertSchemaMatchesEntity(valid, User, dataSource))
            .not.toThrow();

        const invalid = defineSchema({
            name: 'target-invalid',
            filters: { allowed: ['renamedAway'] },
        });
        expect(grabError(() => assertSchemaMatchesEntity(invalid, User, dataSource)).keys)
            .toEqual(['renamedAway']);
    });
});

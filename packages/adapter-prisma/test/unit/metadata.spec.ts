/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode } from '@rapiq/core';
import { PrismaAdapter, defineMetadata, resolveProvider } from '../../src';
import { datamodel } from '../data/datamodel';

describe('src/metadata/module.ts', () => {
    const metadata = defineMetadata(datamodel, 'User');

    it('should resolve relation cardinality', () => {
        expect(metadata.isToMany('items')).toBe(true);
        expect(metadata.isToMany('realm')).toBe(false);
    });

    it('should resolve cardinality through a relation chain', () => {
        expect(metadata.isToMany('realm.name')).toBeUndefined();
        expect(metadata.isToMany('items.title')).toBeUndefined();
    });

    it('should resolve string-typedness', () => {
        expect(metadata.isString('first_name')).toBe(true);
        expect(metadata.isString('age')).toBe(false);
        expect(metadata.isString('realm.name')).toBe(true);
        expect(metadata.isString('items.title')).toBe(true);
    });

    it('should resolve nullability', () => {
        expect(metadata.isNullable('first_name')).toBe(false);
        expect(metadata.isNullable('address')).toBe(true);
        expect(metadata.isNullable('realm')).toBe(true);
        expect(metadata.isNullable('realm.description')).toBe(true);
    });

    it('should distinguish relations from columns', () => {
        expect(metadata.isRelation('realm')).toBe(true);
        expect(metadata.isRelation('items')).toBe(true);
        expect(metadata.isRelation('first_name')).toBe(false);
        expect(metadata.isRelation('realm.name')).toBe(false);
    });

    it('should reject a root model outside the datamodel', () => {
        // prisma models are PascalCase; the client accessor is not.
        expect(() => defineMetadata(datamodel, 'user')).toThrowError(
            expect.objectContaining({ code: ErrorCode.SCHEMA_UNRESOLVABLE }),
        );
    });

    it('should answer unknown for keys outside the datamodel', () => {
        expect(metadata.isToMany('unknown')).toBeUndefined();
        expect(metadata.isString('unknown')).toBeUndefined();
        expect(metadata.isNullable('unknown')).toBeUndefined();

        // a scalar cannot be traversed further
        expect(metadata.isString('age.nested')).toBeUndefined();
    });
});

describe('src/provider/module.ts', () => {
    const metadata = defineMetadata(datamodel, 'User');

    it('should resolve providers and their aliases', () => {
        expect(resolveProvider('postgresql')).toEqual({ caseInsensitiveMode: true });
        expect(resolveProvider('postgres')).toEqual({ caseInsensitiveMode: true });
        expect(resolveProvider('mssql')).toEqual({ caseInsensitiveMode: false });
        expect(resolveProvider('sqlserver')).toEqual({ caseInsensitiveMode: false });
        expect(resolveProvider('unknown')).toBeUndefined();
    });

    it('should reject an unknown provider instead of defaulting', () => {
        // a silent fallback to postgres would emit `mode: 'insensitive'`
        // that the real connector rejects on every filter.
        expect(() => new PrismaAdapter({ provider: 'postgre', metadata })).toThrowError(
            expect.objectContaining({ code: ErrorCode.FEATURE_UNSUPPORTED }),
        );
    });

    it('should accept an explicit capability preset', () => {
        expect(() => new PrismaAdapter({ provider: { caseInsensitiveMode: false }, metadata })).not.toThrow();
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '@rapiq/core';
import { defineMetadata } from '../../src';
import { datamodel } from '../data';

describe('src/metadata/module.ts', () => {
    const metadata = defineMetadata(datamodel, 'users');

    it('should reject an unknown root table', () => {
        expect(() => defineMetadata(datamodel, 'user')).toThrow(AdapterError);
    });

    it('should classify columns and relations', () => {
        expect(metadata.isRelation('realm')).toBe(true);
        expect(metadata.isRelation('items')).toBe(true);
        expect(metadata.isRelation('age')).toBe(false);
        expect(metadata.isRelation('missing')).toBeUndefined();
    });

    it('should answer relation cardinality', () => {
        expect(metadata.isToMany('items')).toBe(true);
        expect(metadata.isToMany('realm')).toBe(false);
        expect(metadata.isToMany('age')).toBeUndefined();
    });

    it('should walk dotted paths across tables', () => {
        expect(metadata.isString('realm.name')).toBe(true);
        expect(metadata.isNullable('realm.description')).toBe(true);
        expect(metadata.isNullable('items.title')).toBe(false);
        expect(metadata.isRelation('realm.name')).toBe(false);
    });

    it('should answer string typedness', () => {
        expect(metadata.isString('first_name')).toBe(true);
        expect(metadata.isString('age')).toBe(false);
        expect(metadata.isString('realm')).toBeUndefined();
    });

    it('should answer nullability', () => {
        expect(metadata.isNullable('address')).toBe(true);
        expect(metadata.isNullable('first_name')).toBe(false);
        expect(metadata.isNullable('realm')).toBeUndefined();
    });

    it('should treat an undeclared fact as unknown', () => {
        const sparse = defineMetadata({ users: { columns: { name: 'string', age: {} } } }, 'users');

        expect(sparse.isString('name')).toBe(true);
        expect(sparse.isNullable('name')).toBeUndefined();
        expect(sparse.isString('age')).toBeUndefined();
        expect(sparse.isNullable('age')).toBeUndefined();
    });

    it('should not walk through a column', () => {
        expect(metadata.isString('age.value')).toBeUndefined();
    });
});

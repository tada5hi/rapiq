/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { parseField } from '../../../src';

describe('src/helpers/field.ts', () => {
    it('should parse an undotted field against the root alias', () => {
        expect(parseField('name', 'user')).toEqual({
            prefix: 'user',
            name: 'name',
        });

        expect(parseField('name')).toEqual({ name: 'name' });
    });

    it('should treat every dotted prefix as a relation by default', () => {
        expect(parseField('realm.name', 'user')).toEqual({
            relation: 'realm',
            prefix: 'r5_realm',
            name: 'name',
        });

        expect(parseField('role.realm.name', 'user')).toEqual({
            relation: 'role.realm',
            prefix: 'r4_role_5_realm',
            name: 'name',
        });
    });

    it('should keep full relation chains intact with an always-true hook', () => {
        const output = parseField('role.realm.name', 'user', undefined, () => true);

        expect(output).toEqual({
            relation: 'role.realm',
            prefix: 'r4_role_5_realm',
            name: 'name',
        });
    });

    it('should keep a non-relation dotted path on the root alias', () => {
        const output = parseField('profile.firstName', 'user', undefined, () => false);

        expect(output).toEqual({
            prefix: 'user',
            name: 'profile.firstName',
        });
    });

    it('should keep a non-relation dotted path bare without a root alias', () => {
        const output = parseField('profile.firstName', undefined, undefined, () => false);

        expect(output).toEqual({ name: 'profile.firstName' });
    });

    it('should split at the relation boundary', () => {
        const output = parseField(
            'role.profile.firstName',
            'user',
            undefined,
            (path) => path === 'role',
        );

        expect(output).toEqual({
            relation: 'role',
            prefix: 'r4_role',
            name: 'profile.firstName',
        });
    });

    it('should keep multi-level non-relation paths together', () => {
        const output = parseField(
            'profile.name.first',
            'user',
            undefined,
            () => false,
        );

        expect(output).toEqual({
            prefix: 'user',
            name: 'profile.name.first',
        });
    });
});

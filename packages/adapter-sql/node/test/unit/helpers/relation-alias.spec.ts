/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { buildRelationAlias } from '../../../src';

describe('src/helpers/relation-alias.ts', () => {
    it('should length-prefix every path segment', () => {
        expect(buildRelationAlias('realm')).toEqual('r5_realm');
        expect(buildRelationAlias('role.realm')).toEqual('r4_role_5_realm');
    });

    it('should stay injective for relation names containing underscores', () => {
        expect(buildRelationAlias('role_realm')).not.toEqual(buildRelationAlias('role.realm'));
    });

    it('should bound aliases to the database identifier limit', () => {
        const path = 'organizationMemberships.organizationRoleAssignments.permissionsGranted';

        const alias = buildRelationAlias(path);

        expect(alias.length).toBeLessThanOrEqual(63);
        // deterministic — the same path always derives the same alias
        expect(buildRelationAlias(path)).toEqual(alias);
    });

    it('should keep long distinct paths distinct within the identifier limit', () => {
        // both derivations share the first 63 characters — without the
        // hash suffix PostgreSQL would truncate them onto one alias.
        const granted = buildRelationAlias('organizationMemberships.organizationRoleAssignments.permissionsGranted');
        const revoked = buildRelationAlias('organizationMemberships.organizationRoleAssignments.permissionsRevoked');

        expect(granted.length).toBeLessThanOrEqual(63);
        expect(revoked.length).toBeLessThanOrEqual(63);
        expect(granted).not.toEqual(revoked);
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Datamodel } from '../../src';

/**
 * Keyed the way `defineRelations` keys the query namespace; column
 * facts in drizzle's own vocabulary (`dataType`, `nullable`).
 */
export const datamodel : Datamodel = {
    users: {
        columns: {
            id: { dataType: 'number', nullable: false },
            first_name: { dataType: 'string', nullable: false },
            last_name: { dataType: 'string', nullable: false },
            email: { dataType: 'string', nullable: false },
            age: { dataType: 'number', nullable: false },
            address: { dataType: 'string', nullable: true },
            realm_id: { dataType: 'number', nullable: true },
        },
        relations: {
            realm: { target: 'realms', many: false },
            items: { target: 'items', many: true },
        },
    },
    realms: {
        columns: {
            id: { dataType: 'number', nullable: false },
            name: { dataType: 'string', nullable: false },
            description: { dataType: 'string', nullable: true },
        },
    },
    items: {
        columns: {
            id: { dataType: 'number', nullable: false },
            title: { dataType: 'string', nullable: false },
            color: { dataType: 'string', nullable: true },
        },
    },
};

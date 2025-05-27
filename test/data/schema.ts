/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '../../src';
import type { Item, Realm, User } from './type';

const userSchema = defineSchema<User>({
    fields: {
        allowed: [
            'id',
            'name',
            'email',
            'age',
        ],
    },
    relations: {
        allowed: [
            'realm',
            'items',
        ],
    },
    defaultPath: 'user',
    schemaMapping: {
        items: 'item',
    },
});

const itemSchema = defineSchema<Item>({
    fields: {
        allowed: [
            'id',
        ],
    },
    relations: {
        allowed: [
            'user',
            'realm',
        ],
    },
    defaultPath: 'item',
});

const realmSchema = defineSchema<Realm>({
    fields: {
        allowed: [
            'id',
            'name',
            'description',
        ],
    },
    defaultPath: 'realm',
});

const registry = new SchemaRegistry();
registry.add('user', userSchema);
registry.add('item', itemSchema);
registry.add('realm', realmSchema);

export {
    registry,
};

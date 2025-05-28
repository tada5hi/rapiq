/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '../../src';
import type { Item, Realm, User } from './type';

const userSchema = defineSchema<User>({
    name: 'user',
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
    schemaMapping: {
        items: 'item',
    },
});

const itemSchema = defineSchema<Item>({
    name: 'item',
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
});

const realmSchema = defineSchema<Realm>({
    name: 'realm',
    fields: {
        allowed: [
            'id',
            'name',
            'description',
        ],
    },
});

const registry = new SchemaRegistry();
registry.add(userSchema);
registry.add(itemSchema);
registry.add(realmSchema);

export {
    registry,
};

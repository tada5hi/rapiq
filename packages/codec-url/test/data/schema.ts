/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type { Item, Realm, User } from './type';

export const userSchema = defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'email'] },
    relations: {
        allowed: ['realm', 'items'],
        mapping: { abc: 'items' },
    },
    sort: { allowed: ['id', 'name', 'email'] },
    schemaMapping: { items: 'item' },
});

export const itemSchema = defineSchema<Item>({
    name: 'item',
    fields: { allowed: ['id'] },
    filters: { allowed: ['id', 'name'] },
    relations: { allowed: ['user', 'realm'] },
    sort: { allowed: ['id'] },
});

export const realmSchema = defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name', 'description'] },
    filters: { allowed: ['id', 'name'] },
    sort: { allowed: ['id', 'name'] },
});

export const registry = new SchemaRegistry();
registry.add(userSchema);
registry.add(itemSchema);
registry.add(realmSchema);

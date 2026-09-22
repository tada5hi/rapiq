/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type {
    Event,
    Item,
    Realm,
    User,
} from './type';

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
    filters: { allowed: ['id', 'name', 'email'] },
    relations: {
        allowed: [
            'realm',
            'items',
        ],
        mapping: { abc: 'items' },
    },
    sorts: {
        allowed: ['id', 'name', 'email'],
        default: { name: 'DESC' },
    },
    schemaMapping: { items: 'item' },
});

const itemSchema = defineSchema<Item>({
    name: 'item',
    fields: {
        allowed: [
            'id',
        ],
    },
    filters: { allowed: ['id'] },
    relations: {
        allowed: [
            'user',
            'realm',
        ],
    },
    sorts: { allowed: ['id'] },
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
    filters: { allowed: ['id', 'name'] },
    sorts: { allowed: ['id', 'name'] },
});

const eventSchema = defineSchema<Event>({
    name: 'event',
    fields: { allowed: ['id', 'scope', 'name'], default: ['id'] },
    filters: { allowed: ['realmId', 'scope', 'name'] },
    sorts: { allowed: ['createdAt'], default: { createdAt: 'DESC' } },
    groups: {
        allowed: ['scope', 'name'],
        functions: {
            bucket: { allowed: ['createdAt'] },
            period: {
                fn: 'bucket',
                field: 'createdAt',
                unit: ['hour', 'day'],
            },
        },
    },
    aggregates: {
        functions: {
            count: { allowed: ['couponId'] },
            sum: { allowed: ['amount'] },
            total: { fn: 'sum', field: ['amount', 'fee'] },
            revenue: { fn: 'sum', field: 'amount' },
        },
    },
});

const registry = new SchemaRegistry();
registry.add(userSchema);
registry.add(itemSchema);
registry.add(realmSchema);
registry.add(eventSchema);

export {
    registry,
};

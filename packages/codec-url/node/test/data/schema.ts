/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type {
    AuditEvent,
    Item,
    Order,
    Realm,
    User,
} from './type';

export const userSchema = defineSchema<User>({
    name: 'user',
    fields: { allowed: ['id', 'name', 'email', 'age'] },
    filters: { allowed: ['id', 'name', 'email'] },
    relations: {
        allowed: ['realm', 'items'],
        mapping: { abc: 'items' },
    },
    sorts: { allowed: ['id', 'name', 'email'] },
    schemaMapping: { items: 'item' },
});

export const itemSchema = defineSchema<Item>({
    name: 'item',
    fields: { allowed: ['id'] },
    filters: { allowed: ['id', 'name'] },
    relations: { allowed: ['user', 'realm'] },
    sorts: { allowed: ['id'] },
});

export const realmSchema = defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name', 'description'] },
    filters: { allowed: ['id', 'name'] },
    sorts: { allowed: ['id', 'name'] },
});

export const registry = new SchemaRegistry();
registry.add(userSchema);
registry.add(itemSchema);
registry.add(realmSchema);

/**
 * The #938 issue schema: bare columns scope/name, the built-in bucket on
 * createdAt, the built-in count.
 */
export const eventSchema = defineSchema<AuditEvent>({
    name: 'event',
    filters: { allowed: ['realmId'] },
    groups: {
        allowed: ['scope', 'name'],
        functions: { bucket: { allowed: ['createdAt'] } },
    },
    aggregates: { functions: { count: {} } },
});

/**
 * Named functions binding a built-in: period fixes the field and opens
 * the unit, total opens the field, revenue fixes it.
 */
export const orderSchema = defineSchema<Order>({
    name: 'order',
    groups: {
        allowed: ['status'],
        functions: {
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
            total: { fn: 'sum', field: ['amount', 'fee'] },
            revenue: { fn: 'sum', field: 'amount' },
        },
    },
});

export const groupedRegistry = new SchemaRegistry();
groupedRegistry.add(eventSchema);
groupedRegistry.add(orderSchema);

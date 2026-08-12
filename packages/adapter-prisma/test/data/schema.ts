/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { defineMetadata } from '../../src';
import { datamodel } from './datamodel';
import type { Item, Realm, User } from './type';

export const realmSchema = defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name', 'description'] },
    filters: { allowed: ['id', 'name'] },
    sorts: { allowed: ['id', 'name'] },
});

export const itemSchema = defineSchema<Item>({
    name: 'item',
    fields: { allowed: ['id', 'title', 'color'] },
    filters: { allowed: ['id', 'title', 'color'] },
    sorts: { allowed: ['id', 'title'] },
});

export const userSchema = defineSchema<User>({
    name: 'user',
    fields: {
        default: ['id', 'first_name', 'last_name', 'age'],
        allowed: ['email'],
    },
    filters: { allowed: ['id', 'first_name', 'realm_id', 'age', 'address'] },
    pagination: { maxLimit: 50 },
    relations: { allowed: ['realm', 'items'] },
    sorts: { allowed: ['id', 'age', 'first_name'] },
    schemaMapping: { realm: 'realm', items: 'item' },
});

export function createRegistry() : SchemaRegistry {
    const registry = new SchemaRegistry();

    registry.add(userSchema);
    registry.add(realmSchema);
    registry.add(itemSchema);

    return registry;
}

// -----------------------------------------------------------

/**
 * The default adapter binding for the engine-free specs: postgres (so
 * the case-insensitive default is exercised) over the fixture
 * datamodel.
 */
export function createAdapterOptions(overrides: Record<string, any> = {}) {
    return {
        provider: 'postgresql',
        metadata: defineMetadata(datamodel, 'User'),
        ...overrides,
    } as any;
}

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaRegistry, defineSchema } from '@rapiq/core';
import type {
    Article,
    Note,
    Realm,
    Role,
    Tag,
    UserRole,
} from './type';

/**
 * A realm: the root of the fixture graph. Both columns lead an index.
 */
const realmSchema = defineSchema<Realm>({
    name: 'realm',
    fields: { allowed: ['id', 'name'] },
    filters: { allowed: ['id', 'name'], caseSensitive: ['id'] },
    sorts: { allowed: ['id', 'name'] },
    indexes: [['id'], ['name']],
});

/**
 * A role: `name` is filterable but deliberately leads NO index, so a filter
 * on it must fall back to the collection tag.
 */
const roleSchema = defineSchema<Role>({
    name: 'role',
    fields: { allowed: ['id', 'name', 'realmId'] },
    filters: { allowed: ['id', 'name', 'realmId'], caseSensitive: ['id', 'realmId'] },
    relations: { allowed: ['realm'] },
    sorts: { allowed: ['id', 'name'] },
    indexes: [['id'], ['realmId']],
});

/**
 * A junction row. `user` maps onto a schema the registry deliberately does
 * NOT hold, so a query reaching it is a configuration error.
 */
const userRoleSchema = defineSchema<UserRole>({
    name: 'userRole',
    fields: { allowed: ['id', 'userId', 'roleId'] },
    filters: { allowed: ['id', 'userId', 'roleId'], caseSensitive: ['userId', 'roleId'] },
    relations: { allowed: ['user', 'role'] },
    sorts: { allowed: ['id'] },
    indexes: [['userId'], ['roleId']],
    schemaMapping: { user: 'user', role: 'role' },
});

/**
 * The two sides of a many-to-many relation, joined through `article_tag`.
 */
const articleSchema = defineSchema<Article>({
    name: 'article',
    fields: { allowed: ['id', 'title'] },
    filters: { allowed: ['id', 'title'], caseSensitive: ['id'] },
    relations: { allowed: ['tags'] },
    sorts: { allowed: ['id'] },
    indexes: [['id']],
    schemaMapping: { tags: 'tag' },
});

const tagSchema = defineSchema<Tag>({
    name: 'tag',
    fields: { allowed: ['id', 'name'] },
    filters: { allowed: ['id', 'name'], caseSensitive: ['id'] },
    relations: { allowed: ['articles'] },
    sorts: { allowed: ['id'] },
    indexes: [['id']],
    schemaMapping: { articles: 'article' },
});

/**
 * A note: SET NULL onto its realm, so a realm removal moves its rows into
 * the `realmId=null` scope.
 */
const noteSchema = defineSchema<Note>({
    name: 'note',
    fields: { allowed: ['id', 'realmId', 'publishedAt'] },
    filters: { allowed: ['id', 'realmId', 'publishedAt'], caseSensitive: ['realmId'] },
    sorts: { allowed: ['id'] },
    indexes: [['realmId'], ['publishedAt']],
});

const registry = new SchemaRegistry();
registry.add(realmSchema);
registry.add(roleSchema);
registry.add(userRoleSchema);
registry.add(articleSchema);
registry.add(tagSchema);
registry.add(noteSchema);

export {
    articleSchema,
    noteSchema,
    realmSchema,
    roleSchema,
    tagSchema,
    userRoleSchema,
    registry,
};

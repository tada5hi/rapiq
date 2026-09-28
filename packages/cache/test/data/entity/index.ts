/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { EntityMetadata } from 'typeorm';
import { ArticleEntity } from './article';
import { NoteEntity } from './note';
import { RealmEntity } from './realm';
import { RoleEntity } from './role';
import { TagEntity } from './tag';
import { UserRoleEntity } from './user-role';

export const entities = [
    RealmEntity,
    RoleEntity,
    UserRoleEntity,
    ArticleEntity,
    TagEntity,
    NoteEntity,
];

const SCHEMA_NAMES : Record<string, string> = {
    [RealmEntity.name]: 'realm',
    [RoleEntity.name]: 'role',
    [UserRoleEntity.name]: 'userRole',
    [ArticleEntity.name]: 'article',
    [TagEntity.name]: 'tag',
    [NoteEntity.name]: 'note',
};

/**
 * The entity-to-schema mapping the subscriber is handed: an entity the
 * map does not name is an untracked table.
 */
export function resolveSchemaName(metadata: EntityMetadata) : string | undefined {
    return SCHEMA_NAMES[metadata.name];
}

export {
    ArticleEntity,
    NoteEntity,
    RealmEntity,
    RoleEntity,
    TagEntity,
    UserRoleEntity,
};

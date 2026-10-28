/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    OneToMany,
    PrimaryColumn,
} from 'typeorm';
import type { NoteEntity } from './note';
import type { RoleEntity } from './role';

@Entity({ name: 'realm' })
export class RealmEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ type: 'varchar' })
    name!: string;

    /**
     * Saving a realm with a changed list deletes the released roles
     * (`orphanedRowAction: 'delete'` on the role side).
     */
    @OneToMany('RoleEntity', (role: RoleEntity) => role.realm)
    roles!: RoleEntity[];

    /**
     * Saving a realm with a changed list nulls `realm_id` on the released
     * notes (the default `orphanedRowAction`), or binds a listed note that
     * points elsewhere, both through an update that names the note by its
     * key alone.
     */
    @OneToMany('NoteEntity', (note: NoteEntity) => note.realm)
    notes!: NoteEntity[];
}

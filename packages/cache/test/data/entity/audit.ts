/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';
import { RealmEntity } from './realm';
import { RoleEntity } from './role';

/**
 * A table without a rapiq schema: the shared resolver leaves it untracked,
 * a spec tracks it by name alone. The database deletes its rows with their
 * realm (CASCADE) and nulls `role_id` with their role (SET NULL), neither
 * of which fires a hook on it.
 */
@Entity({ name: 'audit' })
export class AuditEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ name: 'realm_id', type: 'varchar' })
    realmId!: string;

    @Column({
        name: 'role_id',
        type: 'varchar',
        nullable: true,
    })
    roleId!: string | null;

    @ManyToOne(() => RealmEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'realm_id' })
    realm!: RealmEntity;

    @ManyToOne(() => RoleEntity, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'role_id' })
    role!: RoleEntity | null;
}

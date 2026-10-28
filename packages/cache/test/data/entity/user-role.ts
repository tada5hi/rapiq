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
import { RoleEntity } from './role';

@Entity({ name: 'user_role' })
export class UserRoleEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ name: 'user_id', type: 'varchar' })
    userId!: string;

    @Column({ name: 'role_id', type: 'varchar' })
    roleId!: string;

    @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role!: RoleEntity;
}

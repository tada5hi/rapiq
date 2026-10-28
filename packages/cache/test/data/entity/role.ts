/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';
import { RealmEntity } from './realm';

@Entity({ name: 'role' })
export class RoleEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ type: 'varchar' })
    name!: string;

    @Column({ name: 'realm_id', type: 'varchar' })
    realmId!: string;

    @ManyToOne(() => RealmEntity, (realm) => realm.roles, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
    @JoinColumn({ name: 'realm_id' })
    realm!: RealmEntity;

    /**
     * Soft deletes: `softRemove` / `recover` and `softDelete` / `restore`
     * write this column instead of removing the row.
     */
    @DeleteDateColumn({
        name: 'deleted_at', 
        type: 'datetime', 
        nullable: true, 
    })
    deletedAt!: Date | null;
}

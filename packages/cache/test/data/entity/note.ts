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

/**
 * A row that survives its realm: the database nulls `realm_id` on the
 * realm's removal (SET NULL), which fires no hook on the note.
 */
@Entity({ name: 'note' })
export class NoteEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({
        name: 'realm_id', 
        type: 'varchar', 
        nullable: true, 
    })
    realmId!: string | null;

    @Column({
        name: 'published_at',
        type: 'datetime',
        nullable: true,
    })
    publishedAt!: Date | null;

    @ManyToOne(() => RealmEntity, (realm) => realm.notes, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'realm_id' })
    realm!: RealmEntity | null;
}

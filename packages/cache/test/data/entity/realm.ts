/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'realm' })
export class RealmEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ type: 'varchar' })
    name!: string;
}

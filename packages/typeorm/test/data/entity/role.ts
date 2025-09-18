/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import {
    Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Realm } from './realm';

@Entity()
export class Role {
    @PrimaryGeneratedColumn()
        id: number;

    @Column()
        name: string;

    @Column({ nullable: true })
        realm_id: number;

    @ManyToOne(() => Realm, (role: Realm) => role.id, { nullable: true })
    @JoinColumn({ name: 'realm_id' })
        realm: Realm;
}

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column, Entity, JoinColumn, ManyToOne,
    PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Realm } from './realm';
import { Role } from './role';

@Unique(['first_name', 'last_name'])
@Entity()
export class User {
    @PrimaryGeneratedColumn()
        id: number;

    @Column()
        age: number;

    @Column({ nullable: true })
        address : string;

    @Column()
        first_name: string;

    @Column()
        last_name: string;

    @Column()
        email: string;

    @Column({ nullable: true })
        role_id: number | null;

    @ManyToOne(() => Role, (role: Role) => role.id, { nullable: true })
    @JoinColumn({ name: 'role_id' })
        role: Role;

    @Column({ nullable: true })
        realm_id: number;

    @ManyToOne(() => Realm, (role: Realm) => role.id, { nullable: true })
    @JoinColumn({ name: 'realm_id' })
        realm: Realm;
}

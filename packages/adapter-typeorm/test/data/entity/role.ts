/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */
import {
    Column, 
    Entity, 
    JoinColumn, 
    ManyToOne, 
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from './profile';
import { Realm } from './realm';
import { RoleDetail } from './role-detail';

@Entity()
export class Role {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({
        name: 'display_name', 
        nullable: true, 
        type: 'varchar', 
    })
    displayName: string | null;

    @Column(() => Profile)
    profile: Profile;

    @Column({ nullable: true })
    realm_id: number;

    @ManyToOne(() => Realm, (role: Realm) => role.id, { nullable: true })
    @JoinColumn({ name: 'realm_id' })
    realm: Realm;

    @Column({ nullable: true })
    detail_id: number | null;

    @ManyToOne(() => RoleDetail, { nullable: true })
    @JoinColumn({ name: 'detail_id' })
    detail: RoleDetail;
}

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* eslint-disable max-classes-per-file --
 * both ends of the to-many relation live here, Activity first, so the
 * design-type metadata of ActivityTag.activity never reads a class in
 * its temporal dead zone through a circular import.
 */

import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Realm } from './realm';

/**
 * Grouping fixture, shaped like the audit events of issue #938:
 * `scope`/`name` are group keys, `created_at` is bucketed, `amount`
 * is summed. `tags` is the only to-many relation of the fixtures,
 * the one a fan-out refusal needs.
 */
@Entity()
export class Activity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    scope: string | null;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'int', default: 0 })
    amount: number;

    @Column({ nullable: true, type: Date })
    created_at: Date | null;

    @Column({ type: 'int', nullable: true })
    realm_id: number | null;

    @ManyToOne(() => Realm, { nullable: true })
    @JoinColumn({ name: 'realm_id' })
    realm: Realm | null;

    @OneToMany(() => ActivityTag, (tag: ActivityTag) => tag.activity)
    tags: ActivityTag[];
}

@Entity()
export class ActivityTag {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'int', nullable: true })
    activity_id: number | null;

    @ManyToOne(() => Activity, (activity: Activity) => activity.tags, { nullable: true })
    @JoinColumn({ name: 'activity_id' })
    activity: Activity;
}

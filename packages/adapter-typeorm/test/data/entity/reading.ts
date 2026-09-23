/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Postgres-only fixture: `timestamptz` is refused by the sqlite and
 * mysql drivers at synchronize, so this entity is NOT part of the
 * shared entity list in `../factory.ts`. Specs build their own
 * postgres data source with `entities: [Reading]`.
 */
@Entity()
export class Reading {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'timestamptz', nullable: true })
    observed_at: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    recorded_at: Date | null;

    @Column({ type: 'date', nullable: true })
    observed_on: string | null;

    @Column({ type: 'int', default: 0 })
    value: number;
}

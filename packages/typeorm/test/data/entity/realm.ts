/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';

@Unique(['name'])
@Entity()
export class Realm {
    @PrimaryGeneratedColumn()
        id: number;

    @Column()
        name: string;
}

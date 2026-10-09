/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Column } from 'typeorm';

/**
 * Embedded (no @Entity) — property paths through it are dotted
 * (e.g. `profile.firstName`) without any relation to join.
 */
export class Profile {
    @Column({ nullable: true, type: 'varchar' })
    firstName: string | null;

    @Column({ nullable: true, type: 'varchar' })
    lastName: string | null;
}

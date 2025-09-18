/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { Role } from '../entity/role';

export async function createRoleSeed(dataSource: DataSource) : Promise<Role[]> {
    const repository = dataSource.getRepository(Role);

    return repository.save([
        {
            name: 'admin',
        },
        {
            name: 'moderator',
        },
    ]);
}

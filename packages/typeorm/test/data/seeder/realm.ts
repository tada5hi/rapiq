/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { Realm } from '../entity/realm';

export async function createRealmSeed(dataSource: DataSource) : Promise<Realm[]> {
    const repository = dataSource.getRepository(Realm);

    return repository.save([
        {
            name: 'master',
        },
    ]);
}

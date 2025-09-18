/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { DataSource } from 'typeorm';
import { User } from '../entity/user';

export async function createUserSeed(dataSource: DataSource) : Promise<User[]> {
    const repository = dataSource.getRepository(User);

    return repository.save([
        {
            first_name: 'Caleb',
            last_name: 'Barrows',
            age: 18,
            address: 'Hogwarts',
            email: 'caleb.barrows@gmail.com',
        },
        {
            first_name: 'Aston',
            last_name: 'Nel',
            age: 60,
            email: 'ashton.nel@gmail.com',
        },
    ]);
}

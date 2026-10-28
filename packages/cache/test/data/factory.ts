/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { EntitySubscriberInterface } from 'typeorm';
import { DataSource } from 'typeorm';
import { entities } from './entity';

/**
 * An in-memory `better-sqlite3` DataSource over the fixture entities, so the
 * specs need no external infrastructure.
 *
 * The subscribers are pushed AFTER `initialize()`: the `subscribers` option
 * only instantiates decorated classes and drops an instance, and
 * `initialize()` replaces the array, so this is how a consumer registers an
 * undecorated instance.
 */
export async function createDataSource(subscribers: EntitySubscriberInterface[] = []) : Promise<DataSource> {
    const dataSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        entities,
        synchronize: true,
    });

    await dataSource.initialize();

    dataSource.subscribers.push(...subscribers);

    return dataSource;
}

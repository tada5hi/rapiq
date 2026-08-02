/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from '@rapiq/core';
import {
    FilterCompoundOperator,
    Filters,
    Query,
    not,
} from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';
import { DrizzleAdapter } from '../../src';
import { createAdapterOptions } from '../data';
import { records, splitRecord } from '../data/records';
import {
    collections,
    complementPairs,
    compounds,
    sameElement,
} from '../data/matrix';
import { createEngine } from '../data/engine';
import type { User } from '../data/type';

/**
 * The cross-backend semantics gate: the emitted config is executed by
 * a real drizzle query engine (in-memory sqlite, no codegen, no
 * server) and must select exactly the records `@rapiq/adapter-memory`
 * selects, the same obligation `@rapiq/adapter-typeorm` and
 * `@rapiq/adapter-prisma` discharge against their engines. The
 * postgres `test:db` suite replays the same matrix plus the case
 * contract (`engine.db.spec.ts`).
 */
describe('cross-adapter complement law (memory vs drizzle engine)', () => {
    const allIds = records.map((record) => record.id).sort((a, b) => a - b);

    const adapter = new DrizzleAdapter(createAdapterOptions({ provider: 'sqlite' }));

    const drizzleIds = async (condition: Condition, rows: User[] = records) : Promise<number[]> => {
        const filters = new Filters(FilterCompoundOperator.AND, [condition]);
        const { config } = adapter.execute(new Query({ filters }));

        const found = await createEngine(rows).query.users.findMany(config);

        return found
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    const memoryIds = (condition: Condition, rows: User[] = records) : number[] => {
        const predicate = compileFilters(condition);

        return rows
            .filter((record) => predicate(record))
            .map((record) => record.id)
            .sort((a, b) => a - b);
    };

    complementPairs.forEach(([name, positive, negative]) => {
        it(`should agree for ${name}`, async () => {
            const positiveIds = await drizzleIds(positive);
            const negativeIds = await drizzleIds(negative);

            expect(positiveIds).toEqual(memoryIds(positive));
            expect(negativeIds).toEqual(memoryIds(negative));

            // the negation selects exactly the remaining records.
            expect([...positiveIds, ...negativeIds].sort((a, b) => a - b)).toEqual(allIds);

            // the first-class NOT node is the same complement.
            expect(await drizzleIds(not(positive))).toEqual(negativeIds);
            expect(memoryIds(not(positive))).toEqual(negativeIds);
        });
    });

    compounds.forEach(([name, condition]) => {
        it(`should agree for ${name}`, async () => {
            expect(await drizzleIds(condition)).toEqual(memoryIds(condition));
        });
    });

    collections.forEach(([name, condition]) => {
        it(`should agree for a to-many path: ${name}`, async () => {
            expect(await drizzleIds(condition)).toEqual(memoryIds(condition));
        });
    });

    sameElement.forEach(([name, condition]) => {
        it(`should bind to the same element for ${name}`, async () => {
            const rows = [...records, splitRecord];

            expect(await drizzleIds(condition, rows)).toEqual(memoryIds(condition, rows));
        });
    });
});

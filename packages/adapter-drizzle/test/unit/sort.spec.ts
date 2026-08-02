/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    Query,
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { createAdapterOptions } from '../data';
import { DrizzleAdapter } from '../../src';

function orderBy(sorts: Sorts) {
    const adapter = new DrizzleAdapter(createAdapterOptions());

    return adapter.execute(new Query({ sorts })).config.orderBy;
}

describe('src/adapter/sort.ts', () => {
    it('should emit nothing without sorts', () => {
        expect(orderBy(new Sorts())).toBeUndefined();
    });

    it('should keep the sort priority through key order', () => {
        const output = orderBy(new Sorts([
            new Sort('age', SortDirection.DESC),
            new Sort('first_name', SortDirection.ASC),
        ]));

        expect(output).toEqual({ age: 'desc', first_name: 'asc' });
        expect(Object.keys(output as object)).toEqual(['age', 'first_name']);
    });

    it('should default to ascending', () => {
        expect(orderBy(new Sorts([new Sort('id')]))).toEqual({ id: 'asc' });
    });

    it('should keep the first occurrence of a duplicate key', () => {
        expect(orderBy(new Sorts([
            new Sort('id', SortDirection.DESC),
            new Sort('id', SortDirection.ASC),
        ]))).toEqual({ id: 'desc' });
    });

    it('should reject a relation path typed', () => {
        // the relational API orders the root by its own columns only;
        // an undocumented nested shape could be silently ignored, and
        // loud beats silent.
        expect(() => orderBy(new Sorts([new Sort('realm.name', SortDirection.DESC)])))
            .toThrow(AdapterError);
    });
});

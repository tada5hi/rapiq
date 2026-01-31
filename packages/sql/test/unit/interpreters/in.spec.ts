/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from '@rapiq/core';
import {
    FiltersAdapter, type FiltersContainerOptions, FiltersVisitor, RelationsAdapter, pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('in (within, nin)', () => {
    let adapter : FiltersAdapter;
    let visitor : FiltersVisitor;

    beforeEach(() => {
        const relationsAdapter = new RelationsAdapter();
        adapter = new FiltersAdapter(
            relationsAdapter,
            options,
        );

        visitor = new FiltersVisitor(adapter);
    });

    it('generates a separate placeholder for every element in the array', () => {
        const condition = new Filter('in', 'age', [1, 2]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });

    it('correctly generates placeholders when combined with other operators', () => {
        const condition = new Filters('and', [
            new Filter('eq', 'name', 'John'),
            new Filter('in', 'age', [1, 2]),
        ]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("name" = $1 and "age" in($2, $3))');
        expect(params).toStrictEqual(['John', 1, 2]);
    });

    it('generates `not in` operator for "nin', () => {
        const condition = new Filter('nin', 'age', [1, 2]);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} not in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });
});

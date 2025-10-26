/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, FiltersVisitor, RelationsAdapter, pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('exists', () => {
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

    it('generates query with `is not null` operator when value equals `true`', () => {
        const condition = new Filter('exists', 'address', true);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} is not null`);
        expect(params).toEqual([]);
    });

    it('generates query with `is null` operator when value equals `false`', () => {
        const condition = new Filter('exists', 'address', false);
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual(`${options.escapeField(condition.field)} is null`);
        expect(params).toEqual([]);
    });
});

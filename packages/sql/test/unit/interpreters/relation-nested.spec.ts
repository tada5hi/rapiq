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

const spy = {
    on: jest.spyOn,
    restore: (..._args: any[]) => jest.clearAllMocks(),
};

const options: FiltersContainerOptions = {
    ...pg,
};

describe('auto join', () => {
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

    it('calls `joinRelation` function passing relation name when using dot notation', () => {
        const condition = new Filter('eq', 'projects.user.name', 'test');
        condition.accept(visitor);
    });

    it('escapes relation name with `options.escapeField`', () => {
        spy.on(options, 'escapeField');

        const condition = new Filter('eq', 'projects.user.name', 'test');
        condition.accept(visitor);

        const [sql] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"user"."name" = $1');
        expect(options.escapeField).toHaveBeenCalledWith('user');
        spy.restore(options, 'escapeField');
    });
});

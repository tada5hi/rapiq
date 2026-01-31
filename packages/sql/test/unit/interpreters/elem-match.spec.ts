/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Filter, Filters } from '@rapiq/core';
import type { FiltersContainerOptions } from '../../../src';
import {
    FiltersAdapter,
    FiltersVisitor,
    RelationsAdapter,
    pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('elemMatch', () => {
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

    it('generates query from a field condition based on relation', () => {
        const condition = new Filter(
            'elemMatch',
            'projects',
            new Filter('eq', 'active', true),
        );
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"projects"."active" = $1');
        expect(params).toStrictEqual([true]);
    });

    it('generates query from a compound condition based on relation', () => {
        const condition = new Filter(
            'elemMatch',
            'projects',
            new Filters('and', [
                new Filter('gt', 'count', 5),
                new Filter('lt', 'count', 10),
            ]),
        );
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("projects"."count" > $1 and "projects"."count" < $2)');
        expect(params).toStrictEqual([5, 10]);
    });
});

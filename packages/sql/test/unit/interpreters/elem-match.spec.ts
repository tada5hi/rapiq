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

const options: FiltersContainerOptions = { ...pg };

describe('elemMatch', () => {
    let relationsAdapter : RelationsAdapter;
    let adapter : FiltersAdapter;
    let visitor : FiltersVisitor;

    beforeEach(() => {
        relationsAdapter = new RelationsAdapter();
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

        expect(sql).toEqual('"r8_projects"."active" = $1');
        expect(params).toStrictEqual([true]);
    });

    it('generates query from a nested condition', () => {
        const condition = new Filter(
            'elemMatch',
            'items',
            new Filter(
                'elemMatch',
                'parts',
                new Filter('eq', 'id', 7),
            ),
        );
        condition.accept(visitor);

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"r5_items_5_parts"."id" = $1');
        expect(params).toStrictEqual([7]);

        // the inner interior binds relative to the OUTER element —
        // the join path composes instead of resetting to the root.
        expect(relationsAdapter.getPaths()).toStrictEqual(['items', 'items.parts']);
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

        expect(sql).toEqual('("r8_projects"."count" > $1 and "r8_projects"."count" < $2)');
        expect(params).toStrictEqual([5, 10]);
    });
});

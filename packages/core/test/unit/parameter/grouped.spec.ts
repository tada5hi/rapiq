/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '../../../src';
import {
    Aggregate,
    Aggregates,
    Fields,
    FilterCompoundOperator,
    Filters,
    Group,
    Groups,
    Pagination,
    Query,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    isAggregates,
    isGroupedQuery,
    isGroups,
    resolveGroupedSorts,
} from '../../../src';

const scope = new Group({
    name: 'scope',
    lowering: {
        fn: undefined,
        field: 'scope',
        args: [],
    },
});
const count = new Aggregate({
    name: 'count',
    lowering: {
        fn: 'count',
        field: undefined,
        args: [],
    },
});

describe('src/parameter/module.ts (groups and aggregates)', () => {
    it('should default both members to empty collections', () => {
        const query = new Query();

        expect(isGroups(query.groups)).toBe(true);
        expect(query.groups.value).toEqual([]);
        expect(isAggregates(query.aggregates)).toBe(true);
        expect(query.aggregates.value).toEqual([]);
    });

    it('should keep the collections it is given', () => {
        const groups = new Groups([scope]);
        const aggregates = new Aggregates([count]);
        const query = new Query({ groups, aggregates });

        expect(query.groups).toBe(groups);
        expect(query.aggregates).toBe(aggregates);
    });
});

describe('src/parameter/check.ts (isGroupedQuery)', () => {
    it('should not treat a plain query as grouped', () => {
        expect(isGroupedQuery(new Query())).toBe(false);
    });

    it('should treat groups or aggregates alone as grouped', () => {
        expect(isGroupedQuery(new Query({ groups: new Groups([scope]) }))).toBe(true);
        expect(isGroupedQuery(new Query({ aggregates: new Aggregates([count]) }))).toBe(true);
    });

    it('should accept an external query without the optional members', () => {
        const external : IQuery = {
            fields: new Fields(),
            filters: new Filters(FilterCompoundOperator.AND, []),
            relations: new Relations(),
            pagination: new Pagination(),
            sorts: new Sorts(),
            accept(visitor) {
                return visitor.visitQuery(this);
            },
        };

        expect(isGroupedQuery(external)).toBe(false);
    });
});

describe('src/parameter/call/module.ts (resolveGroupedSorts)', () => {
    const bucket = new Group({
        name: 'bucket',
        params: ['createdAt', 'day'],
        lowering: {
            fn: 'bucket',
            field: 'createdAt',
            args: ['day'],
        },
    });

    it('should return the explicit sorts when present', () => {
        const sorts = new Sorts([new Sort('count', SortDirection.DESC)]);
        const query = new Query({
            groups: new Groups([bucket, scope]),
            aggregates: new Aggregates([count]),
            sorts,
        });

        const output = resolveGroupedSorts(query);

        expect(output).toEqual(sorts.value);
        expect(output).not.toBe(sorts.value);
    });

    it('should order by every group key ascending in declared order', () => {
        const query = new Query({
            groups: new Groups([bucket, scope]),
            aggregates: new Aggregates([count]),
        });

        expect(resolveGroupedSorts(query).map((sort) => [sort.name, sort.operator])).toEqual([
            ['bucket', SortDirection.ASC],
            ['scope', SortDirection.ASC],
        ]);
    });

    it('should need no order for an aggregates-only query', () => {
        expect(resolveGroupedSorts(new Query({ aggregates: new Aggregates([count]) }))).toEqual([]);
    });
});

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
    ErrorCode,
    Field,
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
    assertGroupedQuery,
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

    it('should append the group keys the explicit sorts do not name as ascending tie-breakers', () => {
        const query = new Query({
            groups: new Groups([bucket, scope]),
            aggregates: new Aggregates([count]),
            sorts: new Sorts([new Sort('count', SortDirection.DESC)]),
        });

        expect(resolveGroupedSorts(query).map((sort) => [sort.name, sort.operator])).toEqual([
            ['count', SortDirection.DESC],
            ['bucket_createdAt_day', SortDirection.ASC],
            ['scope', SortDirection.ASC],
        ]);
    });

    it('should keep the direction of a group key the explicit sorts name', () => {
        const sorts = new Sorts([new Sort('scope', SortDirection.DESC)]);
        const query = new Query({
            groups: new Groups([bucket, scope]),
            sorts,
        });

        const output = resolveGroupedSorts(query);

        expect(output.map((sort) => [sort.name, sort.operator])).toEqual([
            ['scope', SortDirection.DESC],
            ['bucket_createdAt_day', SortDirection.ASC],
        ]);
        expect(sorts.value).toHaveLength(1);
    });

    it('should order by every group key ascending in declared order', () => {
        const query = new Query({
            groups: new Groups([bucket, scope]),
            aggregates: new Aggregates([count]),
        });

        expect(resolveGroupedSorts(query).map((sort) => [sort.name, sort.operator])).toEqual([
            ['bucket_createdAt_day', SortDirection.ASC],
            ['scope', SortDirection.ASC],
        ]);
    });

    it('should need no order for an aggregates-only query', () => {
        expect(resolveGroupedSorts(new Query({ aggregates: new Aggregates([count]) }))).toEqual([]);
    });

    it('should refuse a sort that names no output key', () => {
        const query = new Query({
            groups: new Groups([scope]),
            aggregates: new Aggregates([count]),
            sorts: new Sorts([new Sort('realm.name', SortDirection.ASC)]),
        });

        expect(() => resolveGroupedSorts(query)).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'sorts:grouped',
        }));
    });
});

describe('src/parameter/call/module.ts (assertGroupedQuery)', () => {
    it('should accept a query with groups or aggregates', () => {
        expect(() => assertGroupedQuery(new Query({ groups: new Groups([scope]) }))).not.toThrow();
        expect(() => assertGroupedQuery(new Query({ aggregates: new Aggregates([count]) }))).not.toThrow();
    });

    it('should refuse a query without groups or aggregates', () => {
        expect(() => assertGroupedQuery(new Query())).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'groups:empty',
        }));
    });

    it('should refuse a grouped query carrying fields', () => {
        const query = new Query({
            groups: new Groups([scope]),
            fields: new Fields([new Field('name')]),
        });

        expect(() => assertGroupedQuery(query)).toThrowError(expect.objectContaining({
            code: ErrorCode.FEATURE_UNSUPPORTED,
            feature: 'fields:grouped',
        }));
    });

    it('should refuse an output key written twice, within or across the two parameters', () => {
        const column = new Group({
            name: 'count',
            lowering: {
                fn: undefined,
                field: 'count',
                args: [],
            },
        });

        for (const query of [
            new Query({ groups: new Groups([scope, scope]) }),
            new Query({ groups: new Groups([column]), aggregates: new Aggregates([count]) }),
        ]) {
            expect(() => assertGroupedQuery(query))
                .toThrowError(expect.objectContaining({ code: ErrorCode.KEY_AMBIGUOUS }));
        }
    });

    it('should accept buckets of two columns, now that their keys differ', () => {
        const bucket = (field: string) => new Group({
            name: 'bucket',
            params: [field, 'day'],
            lowering: {
                fn: 'bucket',
                field,
                args: ['day'],
            },
        });

        const query = new Query({ groups: new Groups([bucket('createdAt'), bucket('updatedAt')]) });

        expect(() => assertGroupedQuery(query)).not.toThrow();
    });
});

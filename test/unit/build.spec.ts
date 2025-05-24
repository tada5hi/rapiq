/*
 * Copyright (c) 2021-2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    DEFAULT_ID, type ObjectLiteral, Parameter, SortDirection, URLParameter,
} from '../../src';
import { Builder } from '../../src/builder/module';
import type { BuildInput } from '../../src/builder/types';
import { buildURLQueryString } from '../../src/utils';

function buildQuery<T extends ObjectLiteral = ObjectLiteral>(
    input: BuildInput<T> = {},
) : string {
    const builder = new Builder();
    builder.add(input);

    return builder.toString();
}

describe('src/build.ts', () => {
    type GrandChild = {
        id: string,

        name: string
    };

    type ChildEntity = {
        id: number;

        name: string;

        age: number;

        child: GrandChild
    };

    type Entity = {
        id: number,
        name: string,
        created_at: Date,
        child: ChildEntity,
        siblings: ChildEntity[]
    };

    it('should build filter with number value input', () => {
        const record = buildQuery<Entity>({
            filter: {
                id: 1,
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: 1 } }));
    });

    it('should build filter with null value input', () => {
        const record = buildQuery<Entity>({
            filter: {
                id: null,
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: null } }));
    });

    it('should build filter with undefined value input', () => {
        const record = buildQuery<Entity>({
            filter: {
                id: undefined,
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: null } }));
    });

    it('should build filter with nested input', () => {
        let record = buildQuery<Entity>({
            filter: {
                child: {
                    id: 1,
                },
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { 'child.id': 1 } }));

        record = buildQuery<Entity>({
            filter: {
                'child.id': 1,
                child: {
                    'child.id': 'abc',
                },
            },
        });
        expect(record).toEqual(buildURLQueryString({
            [URLParameter.FILTERS]: {
                'child.id': 1,
                'child.child.id': 'abc',
            },
        }));

        record = buildQuery<Entity>({
            filter: {
                siblings: {
                    id: 1,
                },
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { 'siblings.id': 1 } }));

        record = buildQuery<Entity>({
            filter: {
                id: '!1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '!1' } }));

        record = buildQuery<Entity>({
            filter: {
                id: '~1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '~1' } }));

        // with lessThan
        record = buildQuery<Entity>({
            filter: {
                id: '<1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '<1' } }));

        // with lessThanEqual
        record = buildQuery<Entity>({
            filter: {
                id: '<=1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '<=1' } }));

        // with moreThan
        record = buildQuery<Entity>({
            filter: {
                id: '>1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '>1' } }));

        // with moreThanEqual
        record = buildQuery<Entity>({
            filter: {
                id: '>=1',
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '>=1' } }));

        // with negation & in operator
        record = buildQuery<Entity>({
            filter: {
                id: [null, 1, 2, 3],
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: 'null,1,2,3' } }));

        // with negation & like operator
        record = buildQuery<Entity>({
            filter: {
                id: ['!~1', 2, 3],
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { id: '!~1,2,3' } }));
    });

    it('should format fields record', () => {
        let record = buildQuery<Entity>({
            fields: 'id',
        });

        expect(record).toEqual(buildURLQueryString({ fields: 'id' }));

        record = buildQuery<Entity>({
            fields: ['id', 'name', 'created_at'],
        });

        expect(record).toEqual(buildURLQueryString({ fields: ['id', 'name', 'created_at'] }));

        record = buildQuery<Entity>({
            fields: '+id',
        });

        expect(record).toEqual(buildURLQueryString({ fields: '+id' }));

        record = buildQuery<Entity>({
            fields: ['+id', 'name'],
        });

        expect(record).toEqual(buildURLQueryString({ fields: ['+id', 'name'] }));

        record = buildQuery<Entity>({
            fields: [
                ['id'],
                {
                    child: ['id', 'name'],
                },
            ],
        });

        expect(record).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id'], child: ['id', 'name'] } }));

        record = buildQuery<Entity>({
            fields: [
                ['id'],
                ['name'],
                {
                    child: ['id', 'name'],
                },
            ],
        });

        expect(record).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id', 'name'], child: ['id', 'name'] } }));
        record = buildQuery<Entity>({
            fields: [
                ['id'],
                {
                    child: ['id'],
                },
                {
                    child: ['name'],
                },
            ],
        });

        expect(record).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id'], child: ['id', 'name'] } }));
    });

    it('should format sort record', () => {
        let record = buildQuery<Entity>({
            sort: {
                id: SortDirection.DESC,
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-id' }));

        record = buildQuery<Entity>({
            sort: '-id',
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-id' }));

        record = buildQuery<Entity>({
            sort: ['id', 'name'],
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.SORT]: ['id', 'name'] }));

        record = buildQuery<Entity>({
            sort: {
                child: {
                    id: SortDirection.DESC,
                },
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-child.id' }));
    });

    it('should format page record', () => {
        const record = buildQuery<Entity>({
            [Parameter.PAGINATION]: {
                limit: 10,
                offset: 0,
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.PAGINATION]: { limit: 10, offset: 0 } }));
    });

    it('should format include record', () => {
        const record = buildQuery<Entity>({
            [Parameter.RELATIONS]: {
                child: true,
                siblings: {
                    child: true,
                },
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.RELATIONS]: ['child', 'siblings.child'] }));
    });

    it('should build query from different sources', () => {
        let record;

        record = buildQuery<Entity>({
            [Parameter.FILTERS]: {
                child: {
                    id: 1,
                },
            },
            [URLParameter.FILTERS]: {
                id: 2,
            },
        });
        expect(record).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { 'child.id': 1, id: 2 } }));

        record = buildQuery<Entity>({
            [Parameter.PAGINATION]: {
                limit: 10,
            },
            [URLParameter.PAGINATION]: {
                offset: 0,
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.PAGINATION]: { limit: 10, offset: 0 } }));

        record = buildQuery<Entity>({
            [Parameter.RELATIONS]: ['child', 'child.child'],
            [URLParameter.RELATIONS]: {
                siblings: {
                    child: true,
                },
            },
        });

        expect(record).toEqual(buildURLQueryString({ [URLParameter.RELATIONS]: ['child', 'child.child', 'siblings.child'] }));
    });
});

/*
 * Copyright (c) 2021-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    DEFAULT_ID,
    SortDirection,
    URLParameter,
    builder,
} from '../../../src';
import { buildURLQueryString } from '../../../src/utils';
import type { Entity } from '../../data';
import type { Builder } from '../../../src';

describe('src/build.ts', () => {
    it('should merge builder', () => {
        const builderA = builder<Entity>({
            fields: ['id'],
            filters: {
                id: 1,
            },
        });

        const builderB = builder<Entity>({
            fields: ['name'],
            filters: {
                name: 'foo',
            },
        });

        builderA.mergeWith(builderB);

        expect(builderA.build()).toEqual(buildURLQueryString({
            fields: ['id', 'name'],
            filter: {
                id: 1,
                name: 'foo',
            },
        }));
    });

    it('should format fields record', () => {
        let record = builder<Entity>({
            fields: ['id'],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: 'id' }));

        record = builder<Entity>({
            fields: ['id', 'name', 'created_at'],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: ['id', 'name', 'created_at'] }));

        record = builder<Entity>({
            fields: ['+id'],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: '+id' }));

        record = builder<Entity>({
            fields: ['+id', 'name'],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: ['+id', 'name'] }));

        record = builder<Entity>({
            fields: [
                ['id'],
                {
                    child: ['id', 'name'],
                },
            ],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id'], child: ['id', 'name'] } }));

        record = builder<Entity>({
            fields: [
                ['id', 'name'],
                {
                    child: ['id', 'name'],
                },
            ],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id', 'name'], child: ['id', 'name'] } }));
        record = builder<Entity>({
            fields: [
                ['id'],
                {
                    child: ['id', 'name'],
                },
            ],
        });

        expect(record.build()).toEqual(buildURLQueryString({ fields: { [DEFAULT_ID]: ['id'], child: ['id', 'name'] } }));
    });

    it('should format sort record', () => {
        let record = builder<Entity>({
            sort: {
                id: SortDirection.DESC,
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-id' }));

        record = builder<Entity>({
            sort: '-id',
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-id' }));

        record = builder<Entity>({
            sort: ['id', 'name'],
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.SORT]: ['id', 'name'] }));

        record = builder<Entity>({
            sort: {
                child: {
                    id: SortDirection.DESC,
                },
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.SORT]: '-child.id' }));
    });

    it('should format page record', () => {
        const record = builder<Entity>({
            pagination: {
                limit: 10,
                offset: 0,
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.PAGINATION]: { limit: 10, offset: 0 } }));
    });

    it('should format include record', () => {
        const record = builder<Entity>({
            relations: {
                child: true,
                siblings: {
                    child: true,
                },
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.RELATIONS]: ['child', 'siblings.child'] }));
    });

    fit('should build query from different sources', () => {
        let record : Builder<Entity>;

        record = builder<Entity>({
            filters: {
                child: {
                    id: 1,
                },
                id: 2,
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.FILTERS]: { 'child.id': 1, id: 2 } }));

        record = builder<Entity>({
            pagination: {
                limit: 10,
                offset: 0,
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({ [URLParameter.PAGINATION]: { limit: 10, offset: 0 } }));

        record = builder<Entity>({
            relations: {
                child: {
                    child: true,
                },
                siblings: {
                    child: true,
                },
            },
        });

        expect(record.build()).toEqual(buildURLQueryString({
            [URLParameter.RELATIONS]: ['child.child', 'siblings.child'],
        }));
    });
});

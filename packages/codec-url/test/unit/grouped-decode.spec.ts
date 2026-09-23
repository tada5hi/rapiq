/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Aggregate,
    Aggregates,
    ErrorCode,
    ErrorMessage,
    Filter,
    FilterFieldOperator,
    Filters,
    Group,
    Groups,
} from '@rapiq/core';
import type { ParseError } from '@rapiq/core';
import { URLParameter, createURLCodec, formatErrors } from '../../src';
import { groupedRegistry } from '../data/schema';

const ISSUE_URL = 'filter[realmId]=r1,null&group=bucket(createdAt,day),scope,name&aggregate=count';

const ISSUE_GROUPS = new Groups([
    new Group({
        name: 'bucket',
        params: ['createdAt', 'day'],
        lowering: {
            fn: 'bucket',
            field: 'createdAt',
            args: ['day'],
        },
    }),
    new Group({
        name: 'scope',
        lowering: {
            fn: undefined,
            field: 'scope',
            args: [],
        },
    }),
    new Group({
        name: 'name',
        lowering: {
            fn: undefined,
            field: 'name',
            args: [],
        },
    }),
]);

const ISSUE_AGGREGATES = new Aggregates([
    new Aggregate({
        name: 'count',
        lowering: {
            fn: 'count',
            field: undefined,
            args: [],
        },
    }),
]);

const catchParseError = (fn: () => unknown) : ParseError => {
    try {
        fn();
    } catch (e) {
        return e as ParseError;
    }

    return expect.fail('should have thrown');
};

describe('src/decoder/module.ts', () => {
    const codec = createURLCodec(groupedRegistry);

    describe('group and aggregate parameters', () => {
        it('should decode the issue URL once both are listed in parameters', () => {
            const decoded = codec.decode(ISSUE_URL, {
                schema: 'event',
                parameters: ['filters', 'groups', 'aggregates'],
            });

            expect(decoded!.filters).toEqual(new Filters('and', [
                new Filter(FilterFieldOperator.IN, 'realmId', ['r1', null]),
            ]));
            expect(decoded!.groups).toEqual(ISSUE_GROUPS);
            expect(decoded!.aggregates).toEqual(ISSUE_AGGREGATES);
            expect(decoded!.groups!.value.map((item) => item.key)).toEqual(['bucket_createdAt_day', 'scope', 'name']);
            expect(decoded!.aggregates!.value.map((item) => item.key)).toEqual(['count']);
        });

        it('should decode the issue URL asynchronously once both are flagged', async () => {
            const decoded = await codec.decodeAsync(ISSUE_URL, {
                schema: 'event',
                groups: true,
                aggregates: true,
            });

            expect(decoded!.groups).toEqual(ISSUE_GROUPS);
            expect(decoded!.aggregates).toEqual(ISSUE_AGGREGATES);
        });

        it('should ignore both when the caller did not opt in', () => {
            const decoded = codec.decode(ISSUE_URL, { schema: 'event' });

            expect(decoded!.groups).toEqual(new Groups());
            expect(decoded!.aggregates).toEqual(new Aggregates());
        });

        it('should concatenate repeated group keys in wire order', () => {
            const decoded = codec.decode('group=scope&group=bucket(createdAt,day)', {
                schema: 'event',
                groups: true,
            });

            expect(decoded!.groups!.value.map((item) => item.key)).toEqual(['scope', 'bucket_createdAt_day']);
        });

        it('should report a rejected group against its wire name', () => {
            const error = catchParseError(() => codec.decode('group=secret', {
                schema: 'event',
                groups: true,
            }));

            expect(error.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(formatErrors(error.issues)).toEqual([{
                code: ErrorCode.KEY_NOT_ALLOWED,
                detail: ErrorMessage.keyNotPermitted('secret'),
                source: { parameter: URLParameter.GROUPS },
                meta: { path: 'secret' },
            }]);
        });

        it('should report a rejected aggregate against its wire name', () => {
            const error = catchParseError(() => codec.decode('aggregate=sum(amount)', {
                schema: 'event',
                aggregates: true,
            }));

            expect(formatErrors(error.issues)).toEqual([{
                code: ErrorCode.KEY_NOT_ALLOWED,
                detail: ErrorMessage.keyNotPermitted('sum'),
                source: { parameter: URLParameter.AGGREGATES },
                meta: { path: 'sum' },
            }]);
        });
    });
});

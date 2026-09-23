/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    ErrorMessage,
    Fields,
    FilterCompoundOperator,
    Filters,
    Pagination,
    Relations,
    Sorts,
    defineQuery,
    eq,
    inArray,
    isParseError,
} from '@rapiq/core';
import type { IQuery, IQueryVisitor, ParseError } from '@rapiq/core';
import {
    URLParameter,
    URL_SIMPLE_CODEC,
    createURLCodec,
    formatErrors,
} from '../../src';
import { buildQueryParameters } from '../../src/utils';
import { groupedRegistry } from '../data/schema';

describe('src/utils/encode.ts', () => {
    const aware = createURLCodec(groupedRegistry);

    const issueQuery = defineQuery({
        filters: { realmId: 'r1' },
        groups: [{ name: 'bucket', params: ['createdAt', 'day'] }, 'scope', 'name'],
        aggregates: ['count'],
    });

    const orderQuery = defineQuery({
        groups: [{ name: 'period', params: ['day'] }, 'status'],
        aggregates: [
            { name: 'total', params: ['amount'] },
            { name: 'total', params: ['fee'] },
            'revenue',
            { name: 'count', params: ['couponId'] },
        ],
        sorts: ['-total_amount'],
    });

    describe('buildQueryParameters', () => {
        it('should detect groups and aggregates', () => {
            expect(buildQueryParameters(issueQuery)).toEqual(['filters', 'groups', 'aggregates']);
        });

        it('should tolerate an IQuery without the optional members', () => {
            const legacy : IQuery = {
                fields: new Fields(),
                filters: new Filters(FilterCompoundOperator.AND, [eq('name', 'John')]),
                pagination: new Pagination(),
                relations: new Relations(),
                sorts: new Sorts(),
                accept<R>(visitor: IQueryVisitor<R>) : R {
                    return visitor.visitQuery(legacy);
                },
            };

            expect(buildQueryParameters(legacy)).toEqual(['filters']);
        });
    });

    describe('schema-aware encode', () => {
        it('should keep the issue query through the expression codec', () => {
            expect(decodeURIComponent(aware.encode(issueQuery, { schema: 'event', stamp: false })!)).toEqual(
                'filter=eq(realmId,\'r1\')&group=bucket(createdAt,day),scope,name&aggregate=count',
            );
        });

        it('should keep the issue query through the simple codec', () => {
            const query = defineQuery({
                filters: inArray('realmId', ['r1', null]),
                groups: issueQuery.groups,
                aggregates: issueQuery.aggregates,
            });

            expect(decodeURIComponent(aware.encode(query, {
                schema: 'event',
                codec: URL_SIMPLE_CODEC,
                stamp: false,
            })!)).toEqual(
                'filter[realmId]=r1,null&group=bucket(createdAt,day),scope,name&aggregate=count',
            );
        });

        it('should keep the issue query through encodeAsync', async () => {
            expect(decodeURIComponent((await aware.encodeAsync(issueQuery, {
                schema: 'event',
                stamp: false,
            }))!)).toEqual(
                'filter=eq(realmId,\'r1\')&group=bucket(createdAt,day),scope,name&aggregate=count',
            );
        });

        it('should round-trip named calls and resolve them server side', () => {
            const encoded = aware.encode(orderQuery, { schema: 'order' });

            expect(decodeURIComponent(encoded!)).toEqual(
                'codec=url-expression&sort=-total_amount&group=period(day),status' +
                '&aggregate=total(amount),total(fee),revenue,count(couponId)',
            );

            const decoded = aware.decode(encoded!, {
                schema: 'order',
                parameters: ['groups', 'aggregates', 'sorts'],
            });

            expect(decoded!.groups!.value.map((item) => [item.key, item.lowering])).toEqual([
                ['period_day', {
                    fn: 'bucket',
                    field: 'createdAt',
                    args: ['day'],
                }],
                ['status', {
                    fn: undefined,
                    field: 'status',
                    args: [],
                }],
            ]);
            expect(decoded!.aggregates!.value.map((item) => [item.key, item.lowering])).toEqual([
                ['total_amount', {
                    fn: 'sum',
                    field: 'amount',
                    args: [],
                }],
                ['total_fee', {
                    fn: 'sum',
                    field: 'fee',
                    args: [],
                }],
                ['revenue', {
                    fn: 'sum',
                    field: 'amount',
                    args: [],
                }],
                ['count_couponId', {
                    fn: 'count',
                    field: 'couponId',
                    args: [],
                }],
            ]);
            expect(decoded!.sorts!.value.map((item) => item.name)).toEqual(['total_amount']);
        });

        it('should throw what the server would raise for a unit outside the open slot', () => {
            let error : ParseError | undefined;
            try {
                aware.encode(defineQuery({ groups: [{ name: 'period', params: ['month'] }] }), { schema: 'order' });
            } catch (e) {
                error = e as ParseError;
            }

            expect(isParseError(error)).toBe(true);
            expect(error!.code).toBe(ErrorCode.INPUT_REJECTED);
            expect(formatErrors(error!.issues)).toEqual([{
                code: ErrorCode.KEY_VALUE_INVALID,
                detail: ErrorMessage.callArgumentsInvalid('period'),
                source: { parameter: URLParameter.GROUPS },
                meta: { path: 'period' },
            }]);
        });

        it('should not let a false flag drop the grain in the schema pass', async () => {
            const options = {
                schema: 'event',
                groups: false,
                aggregates: false,
                stamp: false,
            };
            const expected = 'filter=eq(realmId,\'r1\')&group=bucket(createdAt,day),scope,name&aggregate=count';

            expect(decodeURIComponent(aware.encode(issueQuery, options)!)).toEqual(expected);
            expect(decodeURIComponent((await aware.encodeAsync(issueQuery, options))!)).toEqual(expected);
            expect(decodeURIComponent(aware.encode(issueQuery, { ...options, schema: undefined })!)).toEqual(expected);
            expect(decodeURIComponent(aware.encode(issueQuery, {
                ...options,
                codec: URL_SIMPLE_CODEC,
            })!)).toEqual(expected.replace('filter=eq(realmId,\'r1\')', 'filter[realmId]=r1'));
        });

        it('should leave an include no filter traverses to the receiving parse', () => {
            // the pass masks the absent filters, so it cannot tell whether
            // the schema's filters default traverses the include.
            expect(decodeURIComponent(aware.encode(defineQuery({
                groups: ['scope'],
                aggregates: ['count'],
                relations: ['realm'],
            }), { schema: 'event', stamp: false })!)).toEqual('include=realm&group=scope&aggregate=count');
        });

        it('should intersect the caller mask', () => {
            expect(decodeURIComponent(aware.encode(issueQuery, {
                schema: 'event',
                parameters: ['filters'],
                stamp: false,
            })!)).toEqual('filter=eq(realmId,\'r1\')');
        });
    });
});

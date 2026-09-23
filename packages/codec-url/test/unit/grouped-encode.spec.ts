/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    Aggregate,
    Aggregates,
    ErrorCode,
    Group,
    Groups,
    Query,
    defineQuery,
} from '@rapiq/core';
import type { IQuery } from '@rapiq/core';
import { SimpleURLDecoder, SimpleURLEncoder } from '../../src/simple';
import { groupedRegistry } from '../data/schema';

const ISSUE_URL = 'filter[realmId]=r1,null&group=bucket(createdAt,day),scope,name&aggregate=count';

describe('src/simple/encoder/visitors/calls.ts', () => {
    const encoder = new SimpleURLEncoder();
    const decoder = new SimpleURLDecoder();

    const expectRefusal = (query: IQuery, feature: string) => {
        try {
            encoder.encode(query);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
            expect((e as AdapterError).feature).toBe(feature);
        }
    };

    it('should emit groups and aggregates after sorts', () => {
        const query = defineQuery({
            filters: { realmId: 'r1' },
            groups: [{ name: 'bucket', params: ['createdAt', 'day'] }, 'scope', 'name'],
            aggregates: ['count'],
            sorts: ['-count'],
        });

        expect(decodeURIComponent(encoder.encode(query)!)).toEqual(
            'filter[realmId]=r1&sort=-count&group=bucket(createdAt,day),scope,name&aggregate=count',
        );
    });

    it('should emit groups and aggregates asynchronously as well', async () => {
        const query = defineQuery({
            groups: ['scope'],
            aggregates: ['count'],
        });

        expect(decodeURIComponent((await encoder.encodeAsync(query))!)).toEqual(
            'group=scope&aggregate=count',
        );
    });

    it('should round-trip primitives and bare columns without a schema', () => {
        const query = defineQuery({
            groups: [{ name: 'bucket', params: ['createdAt', 'hour'] }, 'scope'],
            aggregates: [{ name: 'sum', params: ['amount'] }, { name: 'sum', params: ['fee'] }, 'count'],
            sorts: ['-sum_amount'],
        });

        const decoded = decoder.decode(encoder.encode(query)!, { groups: true, aggregates: true });

        expect(decoded!.groups!.value.map((item) => [item.name, item.params]))
            .toEqual(query.groups!.value.map((item) => [item.name, item.params]));
        expect(decoded!.aggregates!.value.map((item) => [item.name, item.params]))
            .toEqual(query.aggregates!.value.map((item) => [item.name, item.params]));
        expect(decoded!.sorts).toEqual(query.sorts);
    });

    it('should re-encode the decoded issue URL byte for byte', () => {
        const bound = new SimpleURLDecoder(groupedRegistry);

        const decoded = bound.decode(ISSUE_URL, {
            schema: 'event',
            groups: true,
            aggregates: true,
        });

        expect(decodeURIComponent(encoder.encode(decoded!)!)).toEqual(ISSUE_URL);
    });

    it('should carry unresolved named calls as written', () => {
        const query = defineQuery({
            groups: [{ name: 'period', params: ['day'] }],
            aggregates: [
                { name: 'total', params: ['amount'] },
                { name: 'total', params: ['fee'] },
                'revenue',
            ],
        });

        expect(query.groups!.value[0]!.lowering).toBeUndefined();
        expect(decodeURIComponent(encoder.encode(query)!)).toEqual(
            'group=period(day)&aggregate=total(amount),total(fee),revenue',
        );
    });

    it('should encode a lone groups or aggregates node', () => {
        expect(decodeURIComponent(encoder.encodeGroups(new Groups([
            new Group({ name: 'scope' }),
            new Group({ name: 'bucket', params: ['createdAt', 'month'] }),
        ]))!)).toEqual('group=scope,bucket(createdAt,month)');

        expect(decodeURIComponent(encoder.encodeAggregates(new Aggregates([
            new Aggregate({ name: 'count', params: ['couponId'] }),
        ]))!)).toEqual('aggregate=count(couponId)');

        expect(encoder.encodeGroups(new Groups())).toBeNull();
        expect(encoder.encodeAggregates(new Aggregates())).toBeNull();
    });

    it('should honour the parameter mask', () => {
        const query = defineQuery({
            filters: { realmId: 'r1' },
            groups: ['scope'],
            aggregates: ['count'],
        });

        expect(decodeURIComponent(encoder.encode(query, { parameters: ['filters', 'aggregates'] })!))
            .toEqual('filter[realmId]=r1&aggregate=count');
    });

    it.each([
        ['a comma in the name (would decode as two terms)', new Group({ name: 'a,b' })],
        ['parentheses in the name (would decode as a call)', new Group({ name: 'f(x)' })],
        ['surrounding whitespace (would decode trimmed)', new Group({ name: ' scope' })],
        ['an empty name (would be dropped)', new Group({ name: '' })],
        ['an empty argument (syntax error)', new Group({ name: 'bucket', params: ['createdAt', ''] })],
        ['a quote (reserved by the grammar)', new Group({ name: 'o\'x' })],
    ])('should refuse a group with %s', (_, group) => {
        expectRefusal(new Query({ groups: new Groups([group]) }), 'groups:term');
    });

    it.each([
        ['a parenthesis in an argument (text after the call)', new Aggregate({ name: 'sum', params: ['a)b'] })],
        ['a comma in an argument (would decode as two arguments)', new Aggregate({ name: 'sum', params: ['a,b'] })],
    ])('should refuse an aggregate with %s', (_, aggregate) => {
        expectRefusal(new Query({ aggregates: new Aggregates([aggregate]) }), 'aggregates:term');
    });
});

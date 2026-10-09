/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Fields,
    FilterCompoundOperator,
    Filters,
    Pagination,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    defineQuery,
    eq,
} from '@rapiq/core';
import type { IQuery, IQueryVisitor } from '@rapiq/core';
import { URL_SIMPLE_CODEC, createURLCodec } from '../../src';

/**
 * An IQuery produced outside core (IURLCodecDecoder implementers):
 * groups and aggregates are optional members and absent here.
 */
const legacy : IQuery = {
    fields: new Fields(),
    filters: new Filters(FilterCompoundOperator.AND, [eq('name', 'John')]),
    pagination: new Pagination(),
    relations: new Relations(),
    sorts: new Sorts([new Sort('id', SortDirection.DESC)]),
    accept<R>(visitor: IQueryVisitor<R>) : R {
        return visitor.visitQuery(legacy);
    },
};

describe('src/expression/encoder/module.ts', () => {
    const codec = createURLCodec();

    const query = defineQuery({
        filters: { realmId: 'r1' },
        groups: [{ name: 'bucket', params: ['createdAt', 'day'] }, 'scope', 'name'],
        aggregates: ['count'],
        sorts: ['-count'],
    });

    it('should emit groups and aggregates after sort', () => {
        expect(decodeURIComponent(codec.encode(query, { stamp: false })!)).toEqual(
            'filter=eq(realmId,\'r1\')&sort=-count&group=bucket(createdAt,day),scope,name&aggregate=count',
        );
    });

    it('should round-trip through the stamped facade', () => {
        const decoded = codec.decode(codec.encode(query)!, { groups: true, aggregates: true });

        expect(decoded!.groups).toEqual(query.groups);
        expect(decoded!.aggregates).toEqual(query.aggregates);
        expect(decoded!.sorts).toEqual(query.sorts);
    });

    it('should round-trip asynchronously', async () => {
        const encoded = await codec.encodeAsync(query);
        const decoded = await codec.decodeAsync(encoded!, { groups: true, aggregates: true });

        expect(decoded!.groups).toEqual(query.groups);
        expect(decoded!.aggregates).toEqual(query.aggregates);
    });

    it('should honour the parameter mask', () => {
        expect(decodeURIComponent(codec.encode(query, {
            parameters: ['filters', 'groups'],
            stamp: false,
        })!)).toEqual('filter=eq(realmId,\'r1\')&group=bucket(createdAt,day),scope,name');
    });

    it('should keep a query without groups byte-identical in both dialects', () => {
        expect(decodeURIComponent(codec.encode(legacy, { stamp: false })!))
            .toEqual('filter=eq(name,\'John\')&sort=-id');
        expect(decodeURIComponent(codec.encode(legacy, { codec: URL_SIMPLE_CODEC, stamp: false })!))
            .toEqual('filter[name]=John&sort=-id');
        expect(codec.encode(defineQuery({ filters: { name: 'John' }, sorts: ['-id'] }), { stamp: false }))
            .toEqual(codec.encode(legacy, { stamp: false }));
    });
});

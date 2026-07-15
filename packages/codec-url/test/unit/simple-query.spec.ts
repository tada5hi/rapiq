/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    ErrorCode,
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    and,
    defineQuery,
    eq,
    gte,
    or,
} from '@rapiq/core';
import { SimpleURLEncoder } from '../../src/simple';

describe('query', () => {
    let encoder : SimpleURLEncoder;

    beforeAll(() => {
        encoder = new SimpleURLEncoder();
    });

    it('should encode query with documented parameter format', () => {
        const query = new Query({
            fields: new Fields([
                new Field('id'),
                new Field('name'),
            ]),
            filters: new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.EQUAL, 'id', 1),
            ]),
            pagination: new Pagination(20, 10),
            relations: new Relations([
                new Relation('realm'),
            ]),
            sorts: new Sorts([
                new Sort('id', SortDirection.DESC),
            ]),
        });

        const encoded = encoder.encode(query);

        expect(decodeURIComponent(encoded!)).toEqual(
            'fields=id,name&filter[id]=1&page[limit]=20&page[offset]=10&include=realm&sort=-id',
        );
    });

    it('should encode a defineQuery-built query without magic value strings', () => {
        // plan 012 entity-client archetype: typed operator objects in,
        // wire prefixes (~) stay a codec concern.
        const query = defineQuery({
            fields: ['id', 'name'],
            filters: { name: { $contains: 'oh' } },
            pagination: { limit: 20 },
            sort: '-id',
        });

        const encoded = encoder.encode(query);

        expect(decodeURIComponent(encoded!)).toEqual(
            'fields=id,name&filter[name]=~oh~&page[limit]=20&sort=-id',
        );
    });

    it('should throw a typed error when encoding an or compound', () => {
        // subset law: the simple dialect expresses flat root-AND only —
        // no silent flattening into changed semantics.
        const query = defineQuery({ filters: or(gte('age', 18), eq('email', null)) });

        try {
            encoder.encode(query);
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(AdapterError);
            expect((e as AdapterError).code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        }
    });

    it('should throw a typed error when encoding a nested compound group', () => {
        const query = defineQuery({
            filters: and(
                eq('name', 'John'),
                or(gte('age', 18), eq('email', null)),
            ),
        });

        expect(() => encoder.encode(query)).toThrowError(AdapterError);
    });
});

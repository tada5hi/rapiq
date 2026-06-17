/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
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
} from '@rapiq/core';
import { URLEncoder } from '../../src';

describe('query', () => {
    let encoder : URLEncoder;

    beforeAll(() => {
        encoder = new URLEncoder();
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
});

/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { registry } from '../../data/schema';
import { ExpressionParser } from '../../../src';

describe('src/parser', () => {
    let parser : ExpressionParser;
    beforeAll(() => {
        parser = new ExpressionParser(registry);
    });

    it('should parse a full query input', async () => {
        const output = parser.parse({
            fields: ['id', 'name'],
            filters: 'eq(name, \'John\')',
            relations: ['realm'],
            pagination: { limit: 10 },
        }, { schema: 'user' });

        // the included relation projects the related schema's allowed fields
        expect(output.fields).toEqual(new Fields([
            new Field('id'),
            new Field('name'),
            new Field('realm.id'),
            new Field('realm.name'),
            new Field('realm.description'),
        ]));
        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'John'),
        ]));
        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
        expect(output.pagination.limit).toEqual(10);

        // absent sort parameter -> schema default applies
        expect(output.sorts).toEqual(new Sorts([
            new Sort('name', SortDirection.DESC),
        ]));
    });

    it('should enforce the relations allow-list in full-query parsing', async () => {
        const output = parser.parse({ relations: ['realm', 'owner'] }, { schema: 'user' });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
    });
});

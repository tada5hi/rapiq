/*
 * Copyright (c) 2026.
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
    FiltersParseError,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { registry } from '../../data/schema';
import { MongoParser } from '../../../src';

describe('src/parser', () => {
    let parser : MongoParser;

    beforeAll(() => {
        parser = new MongoParser(registry);
    });

    it('should parse a full query input', () => {
        const output = parser.parse({
            fields: ['id', 'name'],
            filters: {
                $or: [
                    { name: 'John' },
                    { email: { $contains: '@example.com' } },
                ],
            },
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

        // an explicit root compound stays the root node.
        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.OR, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'John'),
            new Filter(FilterFieldOperator.CONTAINS, 'email', '@example.com'),
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

    it('should enforce the relations allow-list in full-query parsing', () => {
        const output = parser.parse({ relations: ['realm', 'owner'] }, { schema: 'user' });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
    });

    it('should gate filter relation paths by the relations parameter', () => {
        const output = parser.parse({
            relations: ['realm'],
            filters: {
                'items.id': 1,
                'realm.id': 5,
            },
        }, { schema: 'user' });

        expect(output.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));

        // items is not included -> its filter path is dropped.
        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'realm.id', 5),
        ]));
    });

    it('should keep relation filter paths ungated without a relations parameter', () => {
        const output = parser.parse({ filters: { 'items.id': 1 } }, { schema: 'user' });

        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'items.id', 1),
        ]));
    });

    it('should keep dotted fields when parsing without a schema', () => {
        const composite = new MongoParser();

        const output = composite.parse({ filters: { 'user.friends': 5 } });

        expect(output.filters).toEqual(new Filters(
            FilterCompoundOperator.AND,
            [new Filter(FilterFieldOperator.EQUAL, 'user.friends', 5)],
        ));
    });

    it('should drop undeclared filter keys when parsing with the strict option', () => {
        const composite = new MongoParser();

        const output = composite.parse({ filters: { name: 'admin' } }, { strict: true });

        expect(output.filters).toEqual(new Filters(FilterCompoundOperator.AND, []));
    });

    it('should always throw on filter grammar errors in full-query parsing', () => {
        const error = FiltersParseError.operatorUnsupported('$where');

        expect(() => parser.parse({ filters: { $where: 'this.a > 1' } }, { schema: 'user' })).toThrow(error);
    });
});

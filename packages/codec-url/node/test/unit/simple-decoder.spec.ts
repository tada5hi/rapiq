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
    Relation,
    Relations,
    SchemaRegistry,
    Sort,
    SortDirection,
    Sorts,
    defineSchema,
} from '@rapiq/core';
import { SimpleURLDecoder } from '../../src/simple';

describe('decoder', () => {
    it('should not fabricate filters from unrelated parameters on an empty filter value', () => {
        const decoder = new SimpleURLDecoder();

        // present-but-empty must not fall back to reading the whole
        // payload (page[limit] would become an eq condition).
        const output = decoder.decodeFilters('filter=&page[limit]=10');

        expect(output).toEqual(new Filters(FilterCompoundOperator.AND, []));
    });

    it('should decode a query string', () => {
        const decoder = new SimpleURLDecoder();

        const output = decoder.decode(
            'fields=id,name&filter[id]=1&page[limit]=20&page[offset]=10&include=realm&sort=-id',
        );

        expect(output).toBeDefined();
        expect(output!.fields).toEqual(new Fields([
            new Field('id'),
            new Field('name'),
        ]));
        expect(output!.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        ]));
        expect(output!.pagination.limit).toEqual(20);
        expect(output!.pagination.offset).toEqual(10);
        expect(output!.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
        expect(output!.sorts).toEqual(new Sorts([
            new Sort('id', SortDirection.DESC),
        ]));
    });

    it('should decode a pre-parsed query object (req.query)', () => {
        const decoder = new SimpleURLDecoder();

        const output = decoder.decode({
            filter: { id: '1' },
            include: 'realm',
            page: { limit: '20' },
            sort: '-id',
        });

        expect(output).toBeDefined();
        expect(output!.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        ]));
        expect(output!.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
        expect(output!.pagination.limit).toEqual(20);
        expect(output!.sorts).toEqual(new Sorts([
            new Sort('id', SortDirection.DESC),
        ]));
    });

    it('should decode equivalently from string and object input', () => {
        const decoder = new SimpleURLDecoder();

        const fromString = decoder.decode('filter[id]=1&include=realm&sort=-id');
        const fromObject = decoder.decode({
            filter: { id: '1' },
            include: 'realm',
            sort: '-id',
        });

        expect(fromObject).toEqual(fromString);
    });

    it('should validate against a schema', () => {
        const registry = new SchemaRegistry();
        registry.add(defineSchema({
            name: 'user',
            filters: { allowed: ['id'] },
            relations: { allowed: ['realm'] },
            sort: { default: { id: 'DESC' } },
            pagination: { maxLimit: 10 },
        }));

        const decoder = new SimpleURLDecoder(registry);

        const output = decoder.decode({
            filter: { id: '1', secret: 'x' },
            include: ['realm', 'owner'],
            page: { limit: '50' },
        }, { schema: 'user' });

        expect(output).toBeDefined();
        expect(output!.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'id', 1),
        ]));
        expect(output!.relations).toEqual(new Relations([
            new Relation('realm'),
        ]));
        expect(output!.pagination.limit).toEqual(10);

        // absent sort parameter -> schema default applies
        expect(output!.sorts).toEqual(new Sorts([
            new Sort('id', SortDirection.DESC),
        ]));
    });

    it('should await asynchronous schema validation through decodeAsync', async () => {
        const decoder = new SimpleURLDecoder();
        const schema = defineSchema({
            filters: {
                validate: async (filter) => new Filter(
                    filter.operator,
                    filter.field,
                    String(filter.value).toUpperCase(),
                ),
            },
        });

        const output = await decoder.decodeAsync('filter[name]=admin', { schema });

        expect(output!.filters).toEqual(new Filters(FilterCompoundOperator.AND, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
        ]));
    });

    it('should reject undeclared parameters when decoding with the strict option', () => {
        const decoder = new SimpleURLDecoder();

        const output = decoder.decode('filter[name]=admin&include=realm&sort=-id', { strict: true });

        expect(output).toBeDefined();
        expect(output!.filters).toEqual(new Filters(FilterCompoundOperator.AND, []));
        expect(output!.relations).toEqual(new Relations());
        expect(output!.sorts).toEqual(new Sorts());
    });

    it('should return null for non-object input', () => {
        const decoder = new SimpleURLDecoder();

        expect(decoder.decode(1 as never)).toBeNull();
    });
});

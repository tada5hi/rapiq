/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Field,
    Fields,
    Pagination,
    Query,
    Relation,
    Relations,
    Sort,
    SortDirection,
    Sorts,
    and,
    eq,
    gte,
} from '@rapiq/core';
import { applyQuery, compileQuery } from '../../src';

type User = {
    id: number,
    name: string,
    age: number | null,
    realm?: { id: number, name: string } | null,
    items?: { id: number, title: string }[]
};

const users : User[] = [
    {
        id: 1, 
        name: 'Caleb Barrows', 
        age: 18, 
        realm: { id: 1, name: 'master' }, 
        items: [{ id: 10, title: 'first' }],
    },
    {
        id: 2, 
        name: 'Aston Nel', 
        age: 60, 
        realm: { id: 1, name: 'master' },
    },
    {
        id: 3, 
        name: 'Peter Placzek', 
        age: 28, 
        realm: { id: 1, name: 'master' },
    },
    {
        id: 4, 
        name: 'Marta Nel', 
        age: 17, 
        realm: { id: 2, name: 'other' },
    },
    {
        id: 5, 
        name: 'John Doe', 
        age: null, 
    },
];

describe('module', () => {
    it('should apply a whole query', () => {
        const query = new Query({
            filters: and(gte('age', 18), eq('realm.name', 'master')),
            sorts: new Sorts([new Sort('age', SortDirection.DESC)]),
            pagination: new Pagination(2),
            fields: new Fields([new Field('id'), new Field('name')]),
        });

        const output = applyQuery(query, users);

        expect(output.total).toEqual(3);
        expect(output.data).toEqual([
            { id: 2, name: 'Aston Nel' },
            { id: 3, name: 'Peter Placzek' },
        ]);
        expect(output.pagination).toEqual({ limit: 2, offset: undefined });
    });

    it('should keep included relations while projecting', () => {
        const query = new Query({
            filters: eq('id', 1),
            fields: new Fields([new Field('id')]),
            relations: new Relations([new Relation('items')]),
        });

        const output = applyQuery(query, users);

        expect(output.data).toEqual([
            { id: 1, items: [{ id: 10, title: 'first' }] },
        ]);
    });

    it('should not mutate the input collection', () => {
        const input = [...users];

        const query = new Query({
            filters: gte('age', 18),
            sorts: new Sorts([new Sort('age')]),
            pagination: new Pagination(1),
        });

        applyQuery(query, input);

        expect(input).toEqual(users);
    });

    it('should evaluate a single input via matches', () => {
        const compiled = compileQuery(new Query({ filters: and(gte('age', 18), eq('realm.name', 'master')) }));

        expect(compiled.matches(users[0])).toBeTruthy();
        expect(compiled.matches(users[3])).toBeFalsy();
        expect(compiled.matches(users[4])).toBeFalsy();
        expect(compiled.matches(null)).toBeFalsy();
    });

    it('should pass through unchanged when relations are included without field picks', () => {
        const query = new Query({ relations: new Relations([new Relation('items')]) });

        const output = applyQuery(query, users);

        expect(output.data).toEqual(users);
        expect(output.data[0]).toBe(users[0]);
        expect(output.total).toEqual(users.length);
    });

    it('should compile an empty query to a match-all pass-through', () => {
        const output = applyQuery(new Query(), users);

        expect(output.data).toEqual(users);
        expect(output.total).toEqual(users.length);
        expect(output.data[0]).toBe(users[0]);
        expect(output.pagination).toEqual({ limit: undefined, offset: undefined });
    });
});

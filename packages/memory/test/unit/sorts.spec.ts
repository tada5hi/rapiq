/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Sort,
    SortDirection,
    Sorts,
} from '@rapiq/core';
import { compileSorts } from '../../src';

describe('sorts', () => {
    it('should sort ascending and descending', () => {
        const input = [{ age: 30 }, { age: 18 }, { age: 60 }];

        expect([...input].sort(compileSorts(new Sorts([new Sort('age')]))))
            .toEqual([{ age: 18 }, { age: 30 }, { age: 60 }]);

        expect([...input].sort(compileSorts(new Sorts([new Sort('age', SortDirection.DESC)]))))
            .toEqual([{ age: 60 }, { age: 30 }, { age: 18 }]);
    });

    it('should sort strings and dates', () => {
        const names = [{ name: 'b' }, { name: 'a' }];

        expect([...names].sort(compileSorts(new Sorts([new Sort('name')]))))
            .toEqual([{ name: 'a' }, { name: 'b' }]);

        const dates = [
            { created_at: new Date('2024-01-01') },
            { created_at: new Date('2023-01-01') },
        ];

        expect([...dates].sort(compileSorts(new Sorts([new Sort('created_at')]))))
            .toEqual([
                { created_at: new Date('2023-01-01') },
                { created_at: new Date('2024-01-01') },
            ]);
    });

    it('should apply keys in order with a stable tie-break', () => {
        const input = [
            {
                realm: 'a', 
                age: 30, 
                id: 1, 
            },
            {
                realm: 'b', 
                age: 18, 
                id: 2, 
            },
            {
                realm: 'a', 
                age: 18, 
                id: 3, 
            },
            {
                realm: 'a', 
                age: 18, 
                id: 4, 
            },
        ];

        const comparator = compileSorts(new Sorts([
            new Sort('realm'),
            new Sort('age', SortDirection.DESC),
        ]));

        expect([...input].sort(comparator).map((entry) => entry.id))
            .toEqual([1, 3, 4, 2]);
    });

    it('should sort absent values last ascending, first descending', () => {
        const input = [{ age: 30 }, {}, { age: null }, { age: 18 }];

        expect([...input].sort(compileSorts(new Sorts([new Sort('age')]))))
            .toEqual([{ age: 18 }, { age: 30 }, {}, { age: null }]);

        expect([...input].sort(compileSorts(new Sorts([new Sort('age', SortDirection.DESC)]))))
            .toEqual([{}, { age: null }, { age: 30 }, { age: 18 }]);
    });

    it('should resolve dotted to-one paths', () => {
        const input = [
            { realm: { name: 'b' } },
            { realm: { name: 'a' } },
        ];

        expect([...input].sort(compileSorts(new Sorts([new Sort('realm.name')]))))
            .toEqual([{ realm: { name: 'a' } }, { realm: { name: 'b' } }]);
    });

    it('should keep the input order for incomparable values', () => {
        const input = [{ age: 'x' }, { age: 18 }];

        expect([...input].sort(compileSorts(new Sorts([new Sort('age')]))))
            .toEqual([{ age: 'x' }, { age: 18 }]);

        const mixed = [
            { at: new Date(50) },
            { at: 10 },
            { at: new Date(5) },
        ];

        expect([...mixed].sort(compileSorts(new Sorts([new Sort('at')]))))
            .toEqual(mixed);
    });

    it('should sort booleans', () => {
        const input = [{ active: true }, { active: false }, { active: true }];

        expect([...input].sort(compileSorts(new Sorts([new Sort('active')]))))
            .toEqual([{ active: false }, { active: true }, { active: true }]);

        expect([...input].sort(compileSorts(new Sorts([new Sort('active', SortDirection.DESC)]))))
            .toEqual([{ active: true }, { active: true }, { active: false }]);
    });

    it('should resolve paths crossing an array as absent', () => {
        const input = [
            { id: 1, items: [{ title: 'a' }] },
            { id: 2, items: { title: 'b' } },
            { id: 3, items: { title: 'a' } },
        ];

        const byTitle = compileSorts(new Sorts([new Sort('items.title')]));

        expect([...input].sort(byTitle).map((entry) => entry.id))
            .toEqual([3, 2, 1]);
    });
});

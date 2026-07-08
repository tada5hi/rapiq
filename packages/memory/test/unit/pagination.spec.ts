/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Pagination } from '@rapiq/core';
import { compilePagination } from '../../src';

describe('pagination', () => {
    const data = [1, 2, 3, 4, 5];

    it('should slice by limit and offset', () => {
        expect(compilePagination(new Pagination(2))(data)).toEqual([1, 2]);
        expect(compilePagination(new Pagination(2, 2))(data)).toEqual([3, 4]);
        expect(compilePagination(new Pagination(undefined, 3))(data)).toEqual([4, 5]);
    });

    it('should return everything without pagination', () => {
        expect(compilePagination(new Pagination())(data)).toEqual(data);
    });

    it('should not apply falsy values', () => {
        // parity with the typeorm adapter, which applies
        // take/skip only for truthy values.
        expect(compilePagination(new Pagination(0, 0))(data)).toEqual(data);
    });

    it('should ignore negative values', () => {
        expect(compilePagination(new Pagination(-1, -2))(data)).toEqual(data);
    });

    it('should not mutate the input', () => {
        const input = [1, 2, 3];

        compilePagination(new Pagination(1, 1))(input);

        expect(input).toEqual([1, 2, 3]);
    });
});

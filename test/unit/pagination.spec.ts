/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {PaginationParseError, PaginationOptions, parseQueryPagination} from '../../src';

describe('src/pagination/index.ts', () => {
    it('should transform pagination', () => {
        let pagination = parseQueryPagination(undefined, { maxLimit: 50 });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parseQueryPagination(undefined, undefined);
        expect(pagination).toEqual({});

        pagination = parseQueryPagination({ limit: 100 }, { maxLimit: 50 });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parseQueryPagination({ limit: 50 }, { maxLimit: 50 });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parseQueryPagination({ offset: 20, limit: 20 }, { maxLimit: 50 });
        expect(pagination).toEqual({ offset: 20, limit: 20 });
    });

    it('should throw on exceeded limit', () => {
        let options : PaginationOptions = {
            throwOnFailure: true,
            maxLimit: 50
        };

        let evaluate = () => {
            parseQueryPagination({limit: 100}, options);
        }

        const error = PaginationParseError.limitExceeded(50);
        expect(evaluate).toThrowError(error);
    })

    it('should throw on invalid input', () => {
        let options : PaginationOptions = {
            throwOnFailure: true
        };

        let evaluate = () => {
            parseQueryPagination(false, options);
        }

        const error = PaginationParseError.inputInvalid();
        expect(evaluate).toThrowError(error);
    });

    it('should throw on invalid limit', () => {
        let options : PaginationOptions = {
            throwOnFailure: true
        };

        let evaluate = () => {
            parseQueryPagination({limit: false}, options);
        }

        const error = PaginationParseError.keyValueInvalid('limit');
        expect(evaluate).toThrowError(error);
    })

    it('should throw on invalid offset', () => {
        let options : PaginationOptions = {
            throwOnFailure: true
        };

        let evaluate = () => {
            parseQueryPagination({offset: false}, options);
        }

        const error = PaginationParseError.keyValueInvalid('offset');
        expect(evaluate).toThrowError(error);
    })
});

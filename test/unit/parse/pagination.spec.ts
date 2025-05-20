/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    PaginationParseError, PaginationParser, defineSchema,
} from '../../../src';

describe('src/pagination/index.ts', () => {
    let parser : PaginationParser;

    beforeAll(() => {
        parser = new PaginationParser();
    });

    it('should parse with no schema & invalid value', () => {
        const output = parser.parse(undefined);
        expect(output).toEqual({});
    });

    it('should parse pagination', () => {
        const schema = defineSchema({
            pagination: {
                maxLimit: 50,
            },
        });
        let pagination = parser.parse(undefined, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parser.parse({ limit: 100 }, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parser.parse({ limit: 50 }, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = parser.parse({ offset: 20, limit: 20 }, { schema });
        expect(pagination).toEqual({ offset: 20, limit: 20 });
    });

    it('should throw on exceeded limit', () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
                maxLimit: 50,
            },
        });

        const evaluate = () => {
            parser.parse({ limit: 100 }, { schema });
        };

        const error = PaginationParseError.limitExceeded(50);
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid input', () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const evaluate = () => {
            parser.parse(false, { schema });
        };

        const error = PaginationParseError.inputInvalid();
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid limit', () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const evaluate = () => {
            parser.parse({ limit: false }, { schema });
        };

        const error = PaginationParseError.keyValueInvalid('limit');
        expect(evaluate).toThrow(error);
    });

    it('should throw on invalid offset', () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const evaluate = () => {
            parser.parse({ offset: false }, { schema });
        };

        const error = PaginationParseError.keyValueInvalid('offset');
        expect(evaluate).toThrow(error);
    });
});

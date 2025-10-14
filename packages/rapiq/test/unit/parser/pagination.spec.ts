/*
 * Copyright (c) 2021-2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import {
    DecoderPaginationParser, PaginationParseError, defineSchema,
} from '../../../src';

describe('src/pagination/index.ts', () => {
    let parser : DecoderPaginationParser;

    beforeAll(() => {
        parser = new DecoderPaginationParser();
    });

    it('should parse with no schema & invalid value', async () => {
        const output = await parser.parse(undefined);
        expect(output).toEqual({});
    });

    it('should parse pagination', async () => {
        const schema = defineSchema({
            pagination: {
                maxLimit: 50,
            },
        });
        let pagination = await parser.parse(undefined, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = await parser.parse({ limit: 100 }, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = await parser.parse({ limit: 50 }, { schema });
        expect(pagination).toEqual({ offset: 0, limit: 50 });

        pagination = await parser.parse({ offset: 20, limit: 20 }, { schema });
        expect(pagination).toEqual({ offset: 20, limit: 20 });
    });

    it('should throw on exceeded limit', async () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
                maxLimit: 50,
            },
        });

        const error = PaginationParseError.limitExceeded(50);

        await expect(parser.parse({ limit: 100 }, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid input', async () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const error = PaginationParseError.inputInvalid();
        await expect(parser.parse(false, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid limit', async () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const error = PaginationParseError.keyValueInvalid('limit');
        await expect(parser.parse({ limit: false }, { schema })).rejects.toThrow(error);
    });

    it('should throw on invalid offset', async () => {
        const schema = defineSchema({
            pagination: {
                throwOnFailure: true,
            },
        });

        const error = PaginationParseError.keyValueInvalid('offset');

        await expect(parser.parse({ offset: false }, { schema })).rejects.toThrow(error);
    });
});

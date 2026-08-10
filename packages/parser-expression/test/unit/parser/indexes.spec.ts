/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    FiltersParseError,
    SchemaRegistry,
    defineSchema,
    eq,
} from '@rapiq/core';
import { ExpressionParser } from '../../../src';

type Row = {
    id: string,
    realm_id: string,
    created_at: string,
    flag: boolean,
};

const buildRegistry = (throwOnFailure?: boolean) => {
    const registry = new SchemaRegistry();
    registry.add(defineSchema<Row>({
        name: 'row',
        throwOnFailure,
        indexes: [['realm_id', 'created_at']],
        filters: { indexed: true, default: eq('flag', true) },
    }));

    return registry;
};

describe('indexed schemas', () => {
    it('should keep an anchored expression', () => {
        const parser = new ExpressionParser(buildRegistry());
        const output = parser.parseFilters("and(eq(realm_id, 'x'), eq(flag, 'true'))", { schema: 'row' });

        expect(output.value.length).toBeGreaterThan(0);
        expect(output.value).not.toEqual([eq('flag', true)]);
    });

    it('should drop an unanchored expression to the default', () => {
        const parser = new ExpressionParser(buildRegistry());
        const output = parser.parseFilters("eq(created_at, 'x')", { schema: 'row' });

        expect(output.value).toEqual([eq('flag', true)]);
    });

    it('should throw typed under throwOnFailure', () => {
        const parser = new ExpressionParser(buildRegistry(true));

        try {
            parser.parseFilters("eq(created_at, 'x')", { schema: 'row' });
            expect.fail('expected a FiltersParseError');
        } catch (e) {
            expect(e).toBeInstanceOf(FiltersParseError);
            expect((e as FiltersParseError).code).toBe(ErrorCode.KEY_COMBINATION_NOT_INDEXED);
        }
    });
});

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    applyFiltersSchemaValidation,
    defineFiltersSchema,
} from '../../../src';

describe('src/parser/parameter/filters/validate.ts', () => {
    it('should replace and reject leaves while preserving compounds', () => {
        const input = new Filters(FilterCompoundOperator.OR, [
            new Filter(FilterFieldOperator.EQUAL, 'name', 'admin'),
            new Filters(FilterCompoundOperator.AND, [
                new Filter(FilterFieldOperator.GREATER_THAN, 'age', 18),
                new Filter(FilterFieldOperator.EQUAL, 'name', 'guest'),
            ]),
        ]);
        const schema = defineFiltersSchema({
            validate: (filter) => filter.field === 'name' ?
                new Filter(filter.operator, filter.field, String(filter.value).toUpperCase()) :
                undefined,
        });

        expect(applyFiltersSchemaValidation(input, schema)).toEqual(
            new Filters(FilterCompoundOperator.OR, [
                new Filter(FilterFieldOperator.EQUAL, 'name', 'ADMIN'),
                new Filters(FilterCompoundOperator.AND, [
                    new Filter(FilterFieldOperator.EQUAL, 'name', 'GUEST'),
                ]),
            ]),
        );
    });

    it('should preserve a leaf when no validator is configured', () => {
        const input = new Filter(FilterFieldOperator.EQUAL, 'name', 'admin');

        expect(applyFiltersSchemaValidation(input, defineFiltersSchema())).toBe(input);
    });
});

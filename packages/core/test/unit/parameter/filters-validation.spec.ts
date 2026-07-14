/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ErrorCode,
    Filter,
    FilterCompoundOperator,
    FilterFieldOperator,
    Filters,
    SchemaError,
    applyFiltersSchemaValidation,
    defineFiltersSchema,
} from '../../../src';
import type { Validator } from '../../../src';

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

    it('should reject promise-returning validators', () => {
        const input = new Filter(FilterFieldOperator.EQUAL, 'name', 'admin');
        const validate = (async () => input) as unknown as Validator;
        const schema = defineFiltersSchema({ validate });

        try {
            applyFiltersSchemaValidation(input, schema);
            expect.fail('Expected asynchronous validation to throw.');
        } catch (error) {
            expect(error).toBeInstanceOf(SchemaError);
            expect((error as SchemaError).code).toBe(
                ErrorCode.SCHEMA_VALIDATOR_ASYNC_UNSUPPORTED,
            );
        }
    });
});

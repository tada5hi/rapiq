/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BASE_ERROR_MARKER,
    ErrorCode,
    ErrorMessage,
    FieldsParseError,
    FiltersParseError,
    IssueCollector,
    PARSE_ERROR_MARKER,
    Parameter,
    buildErrorFromIssueCollector,
    isParseError, 
    markError, 
} from '../../../src';
import type { IssueItem } from '../../../src';

const violation = (overrides: Partial<IssueItem> = {}) : Omit<IssueItem, 'type'> => ({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FIELDS,
    path: ['secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
    ...overrides,
});

/**
 * A consumer's error class is free to take whatever constructor it likes.
 */
class TenantParseError extends FiltersParseError {
    readonly field : string;

    constructor(field: string) {
        super({
            code: ErrorCode.KEY_NOT_ALLOWED,
            message: `The field ${field} is out of tenant scope.`,
        });

        this.field = field;
    }
}

describe('src/parser/issue/error.ts', () => {
    it('should raise a caught error as itself rather than rebuilding it', () => {
        // rebuilding it would call that constructor with a BaseErrorOptions
        // it never agreed to
        const collector = new IssueCollector();

        const origin = new TenantParseError('salary');
        collector.error(origin, Parameter.FILTERS);
        collector.violation(violation(), true);

        const error = buildErrorFromIssueCollector(collector);

        expect(error).toBe(origin);
        expect(error?.message).toBe('The field salary is out of tenant scope.');
        expect((error as TenantParseError).field).toBe('salary');
        expect(error?.issues).toHaveLength(2);
        expect(isParseError(error)).toBeTruthy();
    });

    it('should keep a branded stand-in intact', () => {
        const foreign = new Error('The key secret is not permitted.');
        markError(foreign, BASE_ERROR_MARKER);
        markError(foreign, PARSE_ERROR_MARKER);

        const collector = new IssueCollector();
        collector.error(foreign as never, Parameter.FIELDS);

        const error = buildErrorFromIssueCollector(collector);

        expect(error).toBe(foreign);
        expect(error?.message).toBe('The key secret is not permitted.');
        expect(error?.issues).toHaveLength(1);
        // the brand a rebuild would have stripped
        expect(isParseError(error)).toBeTruthy();
    });

    it('should still build from a recorded violation that was never thrown', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), true);

        const error = buildErrorFromIssueCollector(collector);

        expect(error).toBeInstanceOf(FieldsParseError);
        expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
        expect(error?.issues).toHaveLength(1);
    });
});

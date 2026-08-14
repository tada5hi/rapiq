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
    FiltersParseError,
    IssueCollector,
    PARSE_ERROR_MARKER,
    Parameter,
    buildErrorFromIssueCollector,
    isParseError, 
    markError, 
} from '../../../src';
import type { IssueInput } from '../../../src';

const violation = (overrides: Partial<IssueInput> = {}) : IssueInput => ({
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
    it('should raise one general failure, whatever it caught', () => {
        const collector = new IssueCollector();

        const origin = new TenantParseError('salary');
        collector.error(origin, Parameter.FILTERS);
        collector.violation(violation(), true);

        const error = buildErrorFromIssueCollector(collector);

        // the abort describes one parameter; the parse also rejected a fields
        // key, so raising the abort would advertise a subset of the failure
        expect(error).not.toBe(origin);
        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.issues).toHaveLength(2);

        // nothing is reconstructed either, so a consumer class with its own
        // constructor survives untouched — as the cause
        expect(error?.cause).toBe(origin);
        expect((error?.cause as TenantParseError).field).toBe('salary');
        expect(isParseError(error)).toBeTruthy();
    });

    it('should keep a branded stand-in as the cause', () => {
        const foreign = new Error('The key secret is not permitted.');
        markError(foreign, BASE_ERROR_MARKER);
        markError(foreign, PARSE_ERROR_MARKER);

        const collector = new IssueCollector();
        collector.error(foreign as never, Parameter.FIELDS);

        const error = buildErrorFromIssueCollector(collector);

        expect(error?.cause).toBe(foreign);
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.message).toBe('The key secret is not permitted.');
        expect(isParseError(error)).toBeTruthy();
    });

    it('should build from a recorded violation that was never thrown', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), true);

        const error = buildErrorFromIssueCollector(collector);

        expect(error?.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error?.cause).toBeUndefined();
        expect(error?.issues).toHaveLength(1);
        expect(error?.issues[0]?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
    });
});

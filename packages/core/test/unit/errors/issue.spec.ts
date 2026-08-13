/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BaseError,
    ErrorCode,
    ErrorMessage,
    FieldsParseError,
    FiltersParseError,
    IssueCollector,
    MAX_ISSUES,
    Parameter,
    ParseError,
    buildErrorFromIssueCollector,
    raiseErrorFromIssueCollector,
} from '../../../src';
import type { Issue } from '../../../src';

const violation = (overrides: Partial<Issue> = {}) : Omit<Issue, 'severity'> => ({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FIELDS,
    path: ['secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
    ...overrides,
});

describe('src/errors/issue.ts', () => {
    it('should record a violation as a warning under a dropping policy', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), false);

        expect(collector.issues).toEqual([{
            code: ErrorCode.KEY_NOT_ALLOWED,
            parameter: Parameter.FIELDS,
            path: ['secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            severity: 'warning',
        }]);
        expect(collector.failed).toBeFalsy();
        expect(buildErrorFromIssueCollector(collector)).toBeUndefined();
    });

    it('should record a violation as an error under a throwing policy', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), true);

        expect(collector.failed).toBeTruthy();
        expect(collector.issues[0]?.severity).toBe('error');
    });

    it('should rebuild the first error-severity issue into its error', () => {
        const collector = new IssueCollector();

        // a warning never decides the outcome, even when it comes first
        collector.violation(violation({ path: ['dropped'] }), false);
        collector.violation(violation({
            parameter: Parameter.FILTERS,
            path: ['name'],
            code: ErrorCode.KEY_VALUE_INVALID,
            message: ErrorMessage.keyValueInvalid('name'),
        }), true);
        collector.violation(violation({ path: ['later'] }), true);

        const error = buildErrorFromIssueCollector(collector);
        expect(error).toBeInstanceOf(FiltersParseError);
        expect(error?.code).toBe(ErrorCode.KEY_VALUE_INVALID);
        expect(error?.message).toBe(ErrorMessage.keyValueInvalid('name'));
        expect(error?.issues).toHaveLength(3);
    });

    it('should rebuild through the error class the failing site named', () => {
        const collector = new IssueCollector();
        collector.violation(violation({ parameter: Parameter.SORTS }), true, FiltersParseError);

        expect(buildErrorFromIssueCollector(collector)).toBeInstanceOf(FiltersParseError);
    });

    it('should keep the origin of a caught error as the cause', () => {
        const collector = new IssueCollector();
        const origin = FieldsParseError.inputInvalid();

        collector.error(origin, Parameter.FIELDS);

        const error = buildErrorFromIssueCollector(collector);
        expect(error).toBeInstanceOf(FieldsParseError);
        expect(error?.code).toBe(ErrorCode.INPUT_INVALID);
        expect(error?.cause).toBe(origin);
    });

    it('should normalize the deprecated sort parameter', () => {
        const collector = new IssueCollector();
        collector.violation(violation({ parameter: Parameter.SORT }), false);

        expect(collector.issues[0]?.parameter).toBe(Parameter.SORTS);
    });

    it('should cap the recorded issues without losing the failure', () => {
        const collector = new IssueCollector();

        collector.violation(violation({ path: ['first'] }), true);
        for (let i = 0; i < MAX_ISSUES + 10; i++) {
            collector.violation(violation({ path: [`key${i}`] }), false);
        }

        expect(collector.issues).toHaveLength(MAX_ISSUES);
        expect(buildErrorFromIssueCollector(collector)?.issues).toHaveLength(MAX_ISSUES);
        expect(collector.issues[0]?.path).toEqual(['first']);
    });

    it('should keep the issue it failed on even past the cap', () => {
        const collector = new IssueCollector();

        for (let i = 0; i < MAX_ISSUES + 10; i++) {
            collector.violation(violation({ path: [`key${i}`] }), false);
        }
        collector.violation(violation({ path: ['late'] }), true);

        // an error whose own issue the cap evicted would hand a consumer a
        // 400 with nothing in it.
        const error = buildErrorFromIssueCollector(collector);
        expect(error?.issues).toHaveLength(MAX_ISSUES + 1);
        expect(error?.issues.some((issue) => issue.severity === 'error')).toBeTruthy();
    });

    it('should throw only when something was rejected', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), false);
        expect(() => raiseErrorFromIssueCollector(collector)).not.toThrow();

        collector.violation(violation(), true);
        expect(() => raiseErrorFromIssueCollector(collector)).toThrow(ParseError);
    });
});

describe('src/errors/base.ts', () => {
    it('should default the issues to an empty list', () => {
        expect(new BaseError('failed').issues).toEqual([]);
        expect(new BaseError({ message: 'failed' }).issues).toEqual([]);
    });

    it('should pass a cause through to the native property', () => {
        const cause = new Error('origin');
        const error = new BaseError({ message: 'failed', cause });

        expect(error.cause).toBe(cause);
    });

    it('should keep the issues out of the enumerable shape', () => {
        const error = new BaseError({
            message: 'failed',
            code: ErrorCode.INPUT_INVALID,
            issues: [{ ...violation(), severity: 'error' }],
        });

        // an error's enumerable shape decides deep equality and what
        // JSON.stringify emits — the trace must not move either.
        expect(Object.keys(error)).toEqual(['code']);
        expect(JSON.parse(JSON.stringify(error))).toEqual({ code: ErrorCode.INPUT_INVALID });
        expect(error.issues).toHaveLength(1);
    });
});

describe('src/errors/types.ts', () => {
    it('should let any conforming class stand in as the rebuild target', () => {
        class DialectParseError extends ParseError {}

        const collector = new IssueCollector();
        collector.violation(violation(), true, DialectParseError);

        // the rebuild depends on the constructor contract, not on the class
        // hierarchy, so a dialect package can name its own error class
        const error = buildErrorFromIssueCollector(collector);
        expect(error).toBeInstanceOf(DialectParseError);
        expect(error?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
        expect(error?.issues).toHaveLength(1);
    });
});

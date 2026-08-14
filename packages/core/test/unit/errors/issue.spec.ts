/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BASE_ERROR_MARKER,
    BaseError,
    ErrorCode,
    ErrorMessage,
    FieldsParseError,
    FiltersParseError,
    IssueCollector,
    MAX_ISSUES,
    PARSE_ERROR_MARKER,
    Parameter,
    ParseError,
    attachIssues,
    buildErrorFromIssueCollector,
    buildIssue,
    extractIssueKey,
    extractIssueParameter,
    isBaseError,
    isParseError,
    markError,
    raiseErrorFromIssueCollector,
} from '../../../src';
import type { IssueInput } from '../../../src';

const violation = (overrides: Partial<IssueInput> = {}) : IssueInput => ({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FIELDS,
    path: ['secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
    ...overrides,
});

describe('src/errors/issue/module.ts', () => {
    it('should claim rapiq\'s two meta keys', () => {
        const issue = buildIssue(violation({ key: 'abc' }));

        // the node is blemish's; parameter and key ride in `meta` because
        // neither is reconstructible from `path`
        expect(issue).toEqual({
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            meta: { parameter: Parameter.FIELDS, key: 'abc' },
        });
        expect(extractIssueParameter(issue)).toBe(Parameter.FIELDS);
        expect(extractIssueKey(issue)).toBe('abc');
    });

    it('should leave meta off an issue that claims neither', () => {
        const issue = buildIssue({
            code: ErrorCode.INPUT_INVALID,
            path: [],
            message: 'nope',
        });

        expect(issue.meta).toBeUndefined();
        expect(extractIssueParameter(issue)).toBeUndefined();
        expect(extractIssueKey(issue)).toBeUndefined();
    });

    it('should carry the offending value as blemish names it', () => {
        expect(buildIssue(violation({ received: 500 })).received).toBe(500);
    });

    it('should ignore a meta bag another library wrote', () => {
        // meta is an open bag by design; a foreign key is not rapiq's to read
        expect(extractIssueParameter({
            type: 'item',
            code: 'value_invalid',
            path: [],
            message: 'nope',
            meta: { parameter: 42 },
        })).toBeUndefined();
    });
});

describe('src/parser/issue/module.ts', () => {
    it('should record nothing while the policy drops', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), false);

        // the key is dropped, nothing will be raised, and a trace nobody can
        // read is a trace nobody should pay for
        expect(collector.issues).toEqual([]);
        expect(collector.failed).toBeFalsy();
        expect(buildErrorFromIssueCollector(collector)).toBeUndefined();
    });

    it('should record a violation under a throwing policy', () => {
        const collector = new IssueCollector();
        collector.violation(violation(), true);

        expect(collector.failed).toBeTruthy();
        expect(collector.issues).toEqual([{
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            meta: { parameter: Parameter.FIELDS },
        }]);
    });

    it('should rebuild the first issue into its error', () => {
        const collector = new IssueCollector();

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
        expect(error?.issues).toHaveLength(2);
    });

    it('should rebuild through the error class the failing site named', () => {
        const collector = new IssueCollector();
        collector.violation(violation({ parameter: Parameter.SORTS }), true, FiltersParseError);

        expect(buildErrorFromIssueCollector(collector)).toBeInstanceOf(FiltersParseError);
    });

    it('should raise a caught error as itself', () => {
        const collector = new IssueCollector();
        const origin = FieldsParseError.inputInvalid();

        collector.error(origin, Parameter.FIELDS);

        // the origin IS the raised error now, so there is nothing left for it
        // to point at as a cause
        const error = buildErrorFromIssueCollector(collector);
        expect(error).toBe(origin);
        expect(error?.code).toBe(ErrorCode.INPUT_INVALID);
        expect(error?.issues).toHaveLength(1);
    });

    it('should take over the trace a caught error carries', () => {
        const origin = FiltersParseError.keyNotPermitted('secret');
        attachIssues(origin, [buildIssue(violation({
            parameter: Parameter.FILTERS,
            path: ['secret'],
        }))]);

        const collector = new IssueCollector();
        collector.error(origin, Parameter.FILTERS, ['items']);

        // the position the throwing site recorded is one no enclosing site
        // could reconstruct, so it is forwarded rather than summarized
        expect(collector.issues).toEqual([{
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['items', 'secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            meta: { parameter: Parameter.FILTERS },
        }]);
        expect(buildErrorFromIssueCollector(collector)).toBe(origin);
    });

    it('should normalize the deprecated sort parameter', () => {
        const collector = new IssueCollector();
        collector.violation(violation({ parameter: Parameter.SORT }), true);

        expect(extractIssueParameter(collector.issues[0]!)).toBe(Parameter.SORTS);
    });

    it('should cap a hostile trace without losing the failure', () => {
        const collector = new IssueCollector();

        collector.violation(violation({ path: ['first'] }), true);
        for (let i = 0; i < MAX_ISSUES + 10; i++) {
            collector.violation(violation({ path: [`key${i}`] }), true);
        }

        // the failure is pinned by the first issue, so a truncated tail
        // changes nothing about the outcome
        expect(collector.issues).toHaveLength(MAX_ISSUES);
        expect(collector.issues[0]?.path).toEqual(['first']);
        expect(buildErrorFromIssueCollector(collector)?.issues).toHaveLength(MAX_ISSUES);
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
            issues: [buildIssue(violation())],
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

describe('src/errors/check.ts', () => {
    it('should recognize an error a foreign copy of the library raised', () => {
        // two copies of @rapiq/core in one process do not share class
        // identity, so the brand stands in for it. A hand-built stand-in
        // proves the guard never reaches for the class.
        const foreign = new Error('The key secret is not permitted.');
        markError(foreign, BASE_ERROR_MARKER);
        markError(foreign, PARSE_ERROR_MARKER);

        expect(foreign instanceof ParseError).toBeFalsy();
        expect(isParseError(foreign)).toBeTruthy();
        expect(isBaseError(foreign)).toBeTruthy();
    });

    it('should recognize the errors it raises itself', () => {
        expect(isParseError(FieldsParseError.inputInvalid())).toBeTruthy();
        expect(isBaseError(FieldsParseError.inputInvalid())).toBeTruthy();

        expect(isBaseError(new BaseError('failed'))).toBeTruthy();
        // a plain BaseError is not a client-input failure
        expect(isParseError(new BaseError('failed'))).toBeFalsy();
    });

    it('should reject anything else', () => {
        expect(isParseError(new Error('nope'))).toBeFalsy();
        expect(isParseError({ code: 'keyNotAllowed' })).toBeFalsy();
        expect(isParseError(undefined)).toBeFalsy();
        expect(isParseError(null)).toBeFalsy();

        // the brand is asserted, not merely present
        expect(isParseError({ [PARSE_ERROR_MARKER]: false })).toBeFalsy();
    });

    it('should keep the brand out of the enumerable shape', () => {
        const error = FieldsParseError.inputInvalid();

        expect(Object.keys(error)).toEqual(['code']);
        expect(JSON.parse(JSON.stringify(error))).toEqual({ code: ErrorCode.INPUT_INVALID });
    });
});

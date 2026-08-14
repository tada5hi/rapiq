/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { INSTANCEOF_PROPERTY, markInstanceof } from '@ebec/core';
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
    buildIssue,
    extractIssueKey,
    extractIssueParameter,
    isBaseError,
    isParseError,
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
    it('should start with nothing to raise', () => {
        // whether a rejection is added at all is the caller's decision, made
        // where the failure policy is known — a dropping policy adds nothing,
        // which the parser suites assert end to end
        expect(new IssueCollector().issues).toEqual([]);
        expect(new IssueCollector().failed).toBeFalsy();
    });

    it('should record what it is handed', () => {
        const collector = new IssueCollector();
        collector.add(violation());

        expect(collector.failed).toBeTruthy();
        expect(collector.issues).toEqual([{
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            meta: { parameter: Parameter.FIELDS },
        }]);
    });

    it('should raise one general failure carrying every issue', () => {
        const collector = new IssueCollector();

        collector.add(violation({
            parameter: Parameter.FILTERS,
            path: ['name'],
            code: ErrorCode.KEY_VALUE_INVALID,
            message: ErrorMessage.keyValueInvalid('name'),
        }));
        collector.add(violation({ path: ['later'] }));

        // two parameters were rejected, so neither of their classes describes
        // the failure: what went wrong is the trace
        const error = ParseError.inputRejected(collector.issues);
        expect(error.constructor).toBe(ParseError);
        expect(error.code).toBe(ErrorCode.INPUT_REJECTED);
        expect(error.issues).toHaveLength(2);
        expect(error.issues.map((issue) => issue.code)).toEqual([
            ErrorCode.KEY_VALUE_INVALID,
            ErrorCode.KEY_NOT_ALLOWED,
        ]);
    });

    it('should keep a caught abort as the cause', () => {
        const collector = new IssueCollector();
        const origin = FieldsParseError.inputInvalid();

        collector.addError(origin, Parameter.FIELDS);

        // the abort becomes an issue like any other rejection; the error
        // object itself is not kept, because everything it knows is here
        expect(collector.issues).toHaveLength(1);
        expect(collector.issues[0]?.code).toBe(ErrorCode.INPUT_INVALID);
        expect(collector.issues[0]?.message).toBe(origin.message);
    });

    it('should take over the trace a caught error carries', () => {
        const origin = FiltersParseError.keyNotPermitted('secret', [buildIssue(violation({
            parameter: Parameter.FILTERS,
            path: ['secret'],
        }))]);

        const collector = new IssueCollector();
        collector.addError(origin, Parameter.FILTERS, ['items']);

        // the position the throwing site recorded is one no enclosing site
        // could reconstruct, so it is forwarded rather than summarized
        expect(collector.issues).toEqual([{
            type: 'item',
            code: ErrorCode.KEY_NOT_ALLOWED,
            path: ['items', 'secret'],
            message: ErrorMessage.keyNotPermitted('secret'),
            meta: { parameter: Parameter.FILTERS },
        }]);
    });

    it('should normalize the deprecated sort parameter', () => {
        const collector = new IssueCollector();
        collector.add(violation({ parameter: Parameter.SORT }));

        expect(extractIssueParameter(collector.issues[0]!)).toBe(Parameter.SORTS);
    });

    it('should cap a hostile trace without losing the failure', () => {
        const collector = new IssueCollector();

        collector.add(violation({ path: ['first'] }));
        for (let i = 0; i < MAX_ISSUES + 10; i++) {
            collector.add(violation({ path: [`key${i}`] }));
        }

        // the failure is pinned by the first issue, so a truncated tail
        // changes nothing about the outcome
        expect(collector.issues).toHaveLength(MAX_ISSUES);
        expect(collector.issues[0]?.path).toEqual(['first']);
    });

    it('should reduce a consumer error class to its issue', () => {
        class TenantParseError extends ParseError {
            readonly field : string;

            constructor(field: string) {
                super({
                    code: ErrorCode.KEY_NOT_ALLOWED,
                    message: `The field ${field} is out of tenant scope.`,
                });

                this.field = field;
            }
        }

        const collector = new IssueCollector();

        collector.addError(new TenantParseError('salary'), Parameter.FILTERS);
        collector.add(violation());

        // only a branded parse error is ever caught, and a client-input
        // failure says everything it has to say in its issue
        expect(collector.issues).toHaveLength(2);
        expect(collector.issues[0]?.message).toBe('The field salary is out of tenant scope.');
        expect(collector.issues[0]?.code).toBe(ErrorCode.KEY_NOT_ALLOWED);
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

        // an error's enumerable shape decides deep equality, so the trace
        // must not move there (the wire form is serialization.spec.ts)
        expect(Object.keys(error)).not.toContain('issues');
        expect(error.issues).toHaveLength(1);
    });
});

describe('src/errors/check.ts', () => {
    it('should recognize an error a foreign copy of the library raised', () => {
        // two copies of @rapiq/core in one process do not share class
        // identity, so the brand stands in for it. A hand-built stand-in
        // proves the guard never reaches for the class.
        const foreign = new Error('The key secret is not permitted.');
        markInstanceof(foreign, BASE_ERROR_MARKER);
        markInstanceof(foreign, PARSE_ERROR_MARKER);

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
        const keys = Object.keys(FieldsParseError.inputInvalid());

        expect(keys).not.toContain(INSTANCEOF_PROPERTY);
        expect(keys.some((key) => key.includes('rapiq'))).toBeFalsy();
    });
});

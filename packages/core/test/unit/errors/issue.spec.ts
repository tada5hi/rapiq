/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    INSTANCEOF_PROPERTY,
    defineIssueGroup,
    flattenIssueItems,
    markInstanceof,
} from '@ebec/core';
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
    ResolutionScope,
    SchemaRegistry,
    SortsParseError,
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

    it('should omit received when the producer did not supply it', () => {
        expect(buildIssue(violation())).not.toHaveProperty('received');
    });

    it('should preserve an explicitly undefined offending value', () => {
        expect(buildIssue(violation({ received: undefined })))
            .toHaveProperty('received', undefined);
    });

    it('should preserve explicitly undefined input refused by a resolution scope', () => {
        const collector = new IssueCollector();
        const scope = ResolutionScope.for(
            new SchemaRegistry(),
            Parameter.FILTERS,
            undefined,
            { issueCollector: collector, throwOnFailure: true },
        );

        scope.refuse({
            code: ErrorCode.KEY_VALUE_INVALID,
            message: ErrorMessage.keyValueInvalid('id'),
            input: undefined,
        });

        expect(collector.issues[0]).toHaveProperty('received', undefined);
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
        // where the failure policy is known: a dropping policy adds nothing,
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

    it('should reduce a caught abort to its issue', () => {
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

    it('should cap nested groups by leaf count without flattening them', () => {
        const collector = new IssueCollector();
        const group = defineIssueGroup({
            code: 'validation_failed',
            path: [],
            message: 'Validation failed.',
            issues: Array.from({ length: MAX_ISSUES + 50 }, (_, index) =>
                buildIssue(violation({ path: [`key${index}`] }))),
        });

        collector.merge([group]);

        expect(collector.issues).toHaveLength(1);
        expect(collector.issues[0]?.type).toBe('group');
        expect(flattenIssueItems(collector.issues)).toHaveLength(MAX_ISSUES);
    });

    it('should discard empty group shells', () => {
        const collector = new IssueCollector();
        collector.merge([defineIssueGroup({
            path: [],
            message: 'Nothing failed.',
            issues: [],
        })]);

        expect(collector.issues).toEqual([]);
    });

    it('should replace the final capped leaf with a later structural abort', () => {
        const collector = new IssueCollector();
        for (let index = 0; index < MAX_ISSUES; index++) {
            collector.add(violation({ path: [`key${index}`] }));
        }

        collector.addError(FiltersParseError.syntaxInvalid('broken'), Parameter.FILTERS);

        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[0]?.path).toEqual(['key0']);
        expect(leaves.at(-1)?.code).toBe(ErrorCode.SYNTAX_INVALID);
    });

    it('should retain earlier terminal aborts when a capped trace receives another', () => {
        const collector = new IssueCollector();
        for (let index = 0; index < MAX_ISSUES; index++) {
            collector.add(violation({ path: [`key${index}`] }));
        }

        collector.addError(FiltersParseError.syntaxInvalid('filters'), Parameter.FILTERS);
        collector.addError(SortsParseError.syntaxInvalid('sorts'), Parameter.SORTS);

        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[0]?.path).toEqual(['key0']);
        expect(leaves[97]?.path).toEqual(['key97']);
        expect(leaves.slice(-2).map((issue) => ({
            parameter: extractIssueParameter(issue),
            message: issue.message,
        }))).toEqual([
            {
                parameter: Parameter.FILTERS,
                message: ErrorMessage.syntaxInvalid('filters'),
            },
            {
                parameter: Parameter.SORTS,
                message: ErrorMessage.syntaxInvalid('sorts'),
            },
        ]);
    });

    it('should retain contextual errors that filled the final free slot', () => {
        const collector = new IssueCollector();
        for (let index = 0; index < MAX_ISSUES - 1; index++) {
            collector.add(violation({ path: [`key${index}`] }));
        }

        collector.addError(new FiltersParseError({
            code: ErrorCode.SYNTAX_INVALID,
            message: ErrorMessage.syntaxInvalid('filters'),
            issues: [buildIssue({
                code: ErrorCode.SYNTAX_INVALID,
                parameter: Parameter.FILTERS,
                path: ['filter-context'],
                message: ErrorMessage.syntaxInvalid('filters'),
            })],
        }), Parameter.FILTERS);
        collector.addError(new SortsParseError({
            code: ErrorCode.SYNTAX_INVALID,
            message: ErrorMessage.syntaxInvalid('sorts'),
            issues: [buildIssue({
                code: ErrorCode.SYNTAX_INVALID,
                parameter: Parameter.SORTS,
                path: ['sort-context'],
                message: ErrorMessage.syntaxInvalid('sorts'),
            })],
        }), Parameter.SORTS);

        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[0]?.path).toEqual(['key0']);
        expect(leaves[97]?.path).toEqual(['key97']);
        expect(leaves.slice(-2).map((issue) => ({
            parameter: extractIssueParameter(issue),
            path: issue.path,
        }))).toEqual([
            { parameter: Parameter.FILTERS, path: ['filter-context'] },
            { parameter: Parameter.SORTS, path: ['sort-context'] },
        ]);
    });

    it('should retain a prefixed carried group while recording a later contextual error', () => {
        const collector = new IssueCollector();
        for (let index = 0; index < MAX_ISSUES - 1; index++) {
            collector.add(violation({ path: [`key${index}`] }));
        }

        collector.addError(new FiltersParseError({
            code: ErrorCode.SYNTAX_INVALID,
            message: ErrorMessage.syntaxInvalid('filters'),
            issues: [defineIssueGroup({
                code: 'context',
                path: [],
                message: 'Context failed.',
                issues: [buildIssue({
                    code: ErrorCode.SYNTAX_INVALID,
                    parameter: Parameter.FILTERS,
                    path: ['filter-context'],
                    message: ErrorMessage.syntaxInvalid('filters'),
                })],
            })],
        }), Parameter.FILTERS, ['items']);
        collector.addError(new SortsParseError({
            code: ErrorCode.SYNTAX_INVALID,
            message: ErrorMessage.syntaxInvalid('sorts'),
            issues: [buildIssue({
                code: ErrorCode.SYNTAX_INVALID,
                parameter: Parameter.SORTS,
                path: ['sort-context'],
                message: ErrorMessage.syntaxInvalid('sorts'),
            })],
        }), Parameter.SORTS);

        const group = collector.issues[98]!;
        expect(group.type).toBe('group');
        expect(group.path).toEqual(['items']);
        expect(flattenIssueItems([group])[0]?.path).toEqual(['items', 'filter-context']);
        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[97]?.path).toEqual(['key97']);
        expect(leaves.slice(-2).map((issue) => extractIssueParameter(issue))).toEqual([
            Parameter.FILTERS,
            Parameter.SORTS,
        ]);
    });

    it('should replace the final leaf of a capped nested group with a structural abort', () => {
        const collector = new IssueCollector();
        collector.merge([defineIssueGroup({
            code: 'validation_failed',
            path: [],
            message: 'Validation failed.',
            issues: Array.from({ length: MAX_ISSUES }, (_, index) =>
                buildIssue(violation({ path: [`key${index}`] }))),
        })]);

        collector.addError(FiltersParseError.syntaxInvalid('broken'), Parameter.FILTERS);

        expect(collector.issues[0]?.type).toBe('group');
        expect(flattenIssueItems([collector.issues[0]!])).toHaveLength(MAX_ISSUES - 1);
        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves.at(-1)?.code).toBe(ErrorCode.SYNTAX_INVALID);
    });

    it('should retain priority aborts while evicting a nested ordinary tail', () => {
        const collector = new IssueCollector();
        collector.merge([defineIssueGroup({
            code: 'validation_failed',
            path: [],
            message: 'Validation failed.',
            issues: [
                defineIssueGroup({
                    code: 'ordinary',
                    path: [],
                    message: 'Ordinary failures.',
                    issues: Array.from({ length: MAX_ISSUES - 1 }, (_, index) =>
                        buildIssue(violation({ path: [`key${index}`] }))),
                }),
                defineIssueGroup({
                    code: 'tail',
                    path: [],
                    message: 'Tail failure.',
                    issues: [buildIssue(violation({ path: ['key99'] }))],
                }),
            ],
        })]);

        collector.addError(FiltersParseError.syntaxInvalid('filters'), Parameter.FILTERS);
        collector.addError(SortsParseError.syntaxInvalid('sorts'), Parameter.SORTS);

        const group = collector.issues[0]!;
        expect(group.type).toBe('group');
        if (group.type === 'group') {
            expect(group.issues).toHaveLength(1);
            expect(group.issues[0]?.type).toBe('group');
        }
        expect(flattenIssueItems([group])).toHaveLength(MAX_ISSUES - 2);
        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[0]?.path).toEqual(['key0']);
        expect(leaves[97]?.path).toEqual(['key97']);
        expect(leaves.slice(-2).map((issue) => extractIssueParameter(issue))).toEqual([
            Parameter.FILTERS,
            Parameter.SORTS,
        ]);
    });

    it('should replace the newest terminal abort when every retained leaf is terminal', () => {
        const collector = new IssueCollector();
        for (let index = 0; index < MAX_ISSUES; index++) {
            collector.addError(FiltersParseError.syntaxInvalid(`filters${index}`), Parameter.FILTERS);
        }

        collector.addError(SortsParseError.syntaxInvalid('sorts'), Parameter.SORTS);

        const leaves = flattenIssueItems(collector.issues);
        expect(leaves).toHaveLength(MAX_ISSUES);
        expect(leaves[0]?.message).toBe(ErrorMessage.syntaxInvalid('filters0'));
        expect(leaves.at(-1)?.message).toBe(ErrorMessage.syntaxInvalid('sorts'));
        expect(leaves.some((issue) => issue.message === ErrorMessage.syntaxInvalid('filters99')))
            .toBeFalsy();
    });

    it('should count grouped leaves in the aggregated message', () => {
        const group = defineIssueGroup({
            path: [],
            message: 'Validation failed.',
            issues: [
                buildIssue(violation({ path: ['a'] })),
                buildIssue(violation({ path: ['b'] })),
            ],
        });

        expect(ParseError.inputRejected([group]).message)
            .toBe(ErrorMessage.inputRejected(2));
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

    it('should default the code to NONE for both constructor forms', () => {
        // the base substrate would derive a code from the class name for a
        // bare message, a value outside rapiq's vocabulary
        expect(new BaseError('failed').code).toBe(ErrorCode.NONE);
        expect(new BaseError({ message: 'failed' }).code).toBe(ErrorCode.NONE);
        expect(new ParseError('failed').code).toBe(ErrorCode.NONE);
        expect(new ParseError().code).toBe(ErrorCode.NONE);
        expect(new FiltersParseError('failed').code).toBe(ErrorCode.NONE);
        expect(new BaseError({ message: 'failed', code: ErrorCode.INPUT_INVALID }).code).toBe(ErrorCode.INPUT_INVALID);
    });

    it('should pass a cause through to the native property', () => {
        const cause = new Error('origin');
        const error = new BaseError({ message: 'failed', cause });

        expect(error.cause).toBe(cause);
    });

    it('should carry the trace as an ordinary property', () => {
        const error = new BaseError({
            message: 'failed',
            code: ErrorCode.INPUT_INVALID,
            issues: [buildIssue(violation())],
        });

        // enumerable, so it shows up when the error is inspected or spread
        expect(Object.keys(error)).toContain('issues');
        expect({ ...error }.issues).toHaveLength(1);
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

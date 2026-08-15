/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BASE_ERROR_INSTANCE, INSTANCEOF_PROPERTY } from '@ebec/core';
import { defineIssueGroup } from 'blemish';
import {
    BASE_ERROR_MARKER,
    BaseError,
    ErrorCode,
    ErrorMessage,
    FiltersParseError,
    PARSE_ERROR_MARKER,
    Parameter,
    ParseError,
    buildIssue,
    isBaseError,
    isParseError,
} from '../../../src';

const issue = () => buildIssue({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FILTERS,
    path: ['items', 'secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
});

/**
 * The wire shape is a contract, not an accident: it is what a receiver parses,
 * and it moves under a caret range on `@ebec/core` unless something pins it.
 */
describe('src/errors/base.ts (serialization)', () => {
    it('should emit the trace, the code and the brand chain', () => {
        const error = ParseError.inputRejected([issue()]);

        expect(JSON.parse(JSON.stringify(error))).toEqual({
            name: 'ParseError',
            message: ErrorMessage.inputRejected(1),
            code: ErrorCode.INPUT_REJECTED,
            issues: [{
                type: 'item',
                code: ErrorCode.KEY_NOT_ALLOWED,
                path: ['items', 'secret'],
                message: ErrorMessage.keyNotPermitted('secret'),
                meta: { parameter: Parameter.FILTERS },
            }],
            // the base substrate marks itself first, so ebec's own guard
            // recognizes a rapiq error through the chain rather than by
            // duck-typing it
            [INSTANCEOF_PROPERTY]: [
                BASE_ERROR_INSTANCE.description,
                BASE_ERROR_MARKER.description,
                PARSE_ERROR_MARKER.description,
            ],
        });
    });

    it('should name the class that was raised', () => {
        const error = FiltersParseError.inputRejected([issue()]);

        expect(JSON.parse(JSON.stringify(error)).name).toBe('FiltersParseError');
    });

    it('should redact circular issue values without mutating the live issue', () => {
        const expected : Record<string, unknown> = { type: 'string' };
        expected.self = expected;
        const received : Record<string, unknown> = { secret: 'token' };
        received.self = received;

        const leaf = buildIssue({
            code: ErrorCode.KEY_VALUE_INVALID,
            parameter: Parameter.FILTERS,
            path: ['items', 'id'],
            message: ErrorMessage.keyValueInvalid('id'),
            received,
        });
        leaf.expected = expected;
        const group = defineIssueGroup({
            path: ['items'],
            message: 'Nested validation failed.',
            issues: [leaf],
        });
        const error = ParseError.inputRejected([group]);

        const serialized = JSON.parse(JSON.stringify(error));
        expect(serialized.issues[0].issues[0]).not.toHaveProperty('expected');
        expect(serialized.issues[0].issues[0]).not.toHaveProperty('received');
        expect(error.issues[0]).toBe(group);
        expect(leaf.expected).toBe(expected);
        expect(leaf.received).toBe(received);
    });

    it('should carry a cause only when there is one', () => {
        expect(JSON.parse(JSON.stringify(new BaseError('failed')))).not.toHaveProperty('cause');

        const error = new BaseError({ message: 'failed', cause: new Error('origin') });
        expect(JSON.parse(JSON.stringify(error)).cause).toMatchObject({ message: 'origin' });
    });

    it('should stay recognizable after a round trip', () => {
        const revived = JSON.parse(JSON.stringify(FiltersParseError.inputRejected([issue()])));

        // the value is a plain object now, not an Error, and `instanceof`
        // could never answer this — the serialized chain is what does
        expect(revived).not.toBeInstanceOf(Error);
        expect(isBaseError(revived)).toBeTruthy();
        expect(isParseError(revived)).toBeTruthy();
    });

    it('should put the trace in the enumerable shape', () => {
        const options = { message: 'failed', code: ErrorCode.INPUT_REJECTED };

        // deep equality reads enumerable own properties, so two failures of
        // the same kind compare equal only when their traces match. Assert the
        // class, the code or the trace — not whole errors.
        expect(new ParseError({ ...options, issues: [issue()] }))
            .not.toEqual(new ParseError({ ...options, issues: [] }));

        // pinned in ONE place: the rest of the members come from the base
        // substrate, and a change there should fail here rather than in three
        // unrelated specs
        expect(Object.keys(new ParseError(options))).toEqual(['code', 'cause', 'errors', 'issues']);
    });
});

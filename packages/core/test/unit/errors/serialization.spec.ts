/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { INSTANCEOF_PROPERTY } from '@ebec/core';
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
            [INSTANCEOF_PROPERTY]: [
                BASE_ERROR_MARKER.description,
                PARSE_ERROR_MARKER.description,
            ],
        });
    });

    it('should name the class that was raised', () => {
        const error = FiltersParseError.inputRejected([issue()]);

        expect(JSON.parse(JSON.stringify(error)).name).toBe('FiltersParseError');
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

    it('should keep the trace out of the enumerable shape', () => {
        const options = { message: 'failed', code: ErrorCode.INPUT_REJECTED };

        // deep equality reads enumerable own properties, NOT toJSON, so a
        // trace that varies with the input must not decide error equality
        expect(Object.keys(new ParseError({ ...options, issues: [issue()] }))).toEqual(['code']);
        expect(new ParseError({ ...options, issues: [issue()] }))
            .toEqual(new ParseError({ ...options, issues: [] }));
    });
});

/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BASE_ERROR_MARKER, markError } from './check';
import type { ObjectLiteral } from '../types';
import { ErrorCode } from './code';
import type { Issue } from 'blemish';
import type { BaseErrorOptions, IBaseError } from './types';

/**
 * Attach a trace to an error without rebuilding it, so class, `code`,
 * `message`, stack and brand all survive. Declared `configurable`, so an
 * error caught mid-parse can be given the trace it was raised from.
 */
export function attachIssues(error: ObjectLiteral, issues: readonly Issue[]) : void {
    Object.defineProperty(error, 'issues', {
        value: issues,
        enumerable: false,
        writable: false,
        configurable: true,
    });
}

export class BaseError extends Error implements IBaseError {
    public readonly code : `${ErrorCode}`;

    /**
     * Every issue the operation recorded, in the order it hit them — this
     * error is the rebuilt form of the first one with `severity: 'error'`.
     * Empty unless the operation collected a trace.
     *
     * Non-enumerable, like the native `message`: an error's enumerable shape
     * is what deep equality and `JSON.stringify` see, and a diagnostic that
     * varies with the input must not decide whether two errors compare equal
     * or change a serialized HTTP body nobody opted into.
     */
    declare public readonly issues : readonly Issue[];

    constructor(input: BaseErrorOptions | string) {
        if (typeof input === 'string') {
            super(input);

            this.code = ErrorCode.NONE;
            attachIssues(this, []);
            markError(this, BASE_ERROR_MARKER);
        } else {
            super(input.message, typeof input.cause === 'undefined' ?
                undefined :
                { cause: input.cause });

            this.code = input.code || ErrorCode.NONE;
            attachIssues(this, input.issues ?? []);
            markError(this, BASE_ERROR_MARKER);
        }
    }
}

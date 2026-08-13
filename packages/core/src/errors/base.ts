/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ErrorCode } from './code';
import type { Issue } from './issue';
import type { BaseErrorOptions, IBaseError } from './types';

function defineIssues(error: BaseError, issues: readonly Issue[]) : void {
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
            defineIssues(this, []);
        } else {
            super(input.message, typeof input.cause === 'undefined' ?
                undefined :
                { cause: input.cause });

            this.code = input.code || ErrorCode.NONE;
            defineIssues(this, input.issues ?? []);
        }
    }
}

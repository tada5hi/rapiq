/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { 
    INSTANCEOF_PROPERTY, 
    markInstanceof, 
    serializeInstanceofChain, 
    toSerializable, 
} from '@ebec/core';
import type { Issue } from 'blemish';
import type { ObjectLiteral } from '../types';
import { BASE_ERROR_MARKER } from './check';
import { ErrorCode } from './code';
import type { BaseErrorOptions, IBaseError, SerializedError } from './types';

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
     * The class that was raised. The native default is `'Error'` for every
     * subclass, which makes a log line and the wire form say nothing about
     * which failure this is. Non-enumerable, like the native property it
     * replaces.
     */
    declare public readonly name : string;

    /**
     * Every rejection the operation recorded, in the order it hit them.
     * Empty unless the operation collected a trace.
     *
     * Non-enumerable, like the native `message`: an error's enumerable shape
     * is what deep equality sees, and a diagnostic that varies with the input
     * must not decide whether two errors compare equal. {@link toJSON} emits
     * it deliberately — an error whose trace does not survive the boundary is
     * an error with nothing to say on the far side.
     */
    declare public readonly issues : readonly Issue[];

    constructor(input: BaseErrorOptions | string) {
        if (typeof input === 'string') {
            super(input);

            this.nameFromClass();

            this.code = ErrorCode.NONE;
            attachIssues(this, []);
            markInstanceof(this, BASE_ERROR_MARKER);
        } else {
            super(input.message, typeof input.cause === 'undefined' ?
                undefined :
                { cause: input.cause });

            this.nameFromClass();

            this.code = input.code || ErrorCode.NONE;
            attachIssues(this, input.issues ?? []);
            markInstanceof(this, BASE_ERROR_MARKER);
        }
    }

    protected nameFromClass() : void {
        Object.defineProperty(this, 'name', {
            value: this.constructor.name,
            enumerable: false,
            writable: true,
            configurable: true,
        });
    }

    /**
     * The wire form: what the far side of a boundary needs to act on this
     * failure, which is the trace, plus the brand chain so `isParseError`
     * still answers once the error is a plain object again.
     *
     * rapiq's own shape rather than ebec's, because what rapiq aggregates is
     * `issues` — data — and never `errors`, a bag of child `Error`s it has no
     * use for.
     */
    toJSON() : SerializedError {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            issues: this.issues,
            ...(typeof this.cause === 'undefined' ?
                {} :
                { cause: toSerializable(this.cause) }),
            [INSTANCEOF_PROPERTY]: serializeInstanceofChain(this),
        };
    }
}

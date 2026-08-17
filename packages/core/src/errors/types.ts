/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IBaseError as IError, Issue } from '@ebec/core';
import type { ErrorCode } from './code';

/**
 * rapiq's own codes, without closing the vocabulary.
 *
 * The literals keep autocomplete and catch a typo in `e.code === '…'`, which
 * matters because branching on `code` is the documented machine contract. The
 * open half is not slack: a trace can merge issues another library recorded,
 * and a consumer's own error class carries its own code, so a closed union
 * would be describing a world rapiq does not control. Same idiom @ebec/core
 * uses for `IssueItem.code`, so the two agree.
 */
export type ErrorCodeInput = `${ErrorCode}` | (string & {});

export type BaseErrorOptions = {
    code?: ErrorCodeInput,
    message: string,
    /**
     * The originating error, passed through to the native ES2022 `cause`
     * so a wrapped failure keeps its origin.
     */
    cause?: unknown,
    /**
     * The trace this error was rebuilt from. See {@link BaseError.issues}.
     */
    issues?: readonly Issue[]
};

/**
 * The shape every error rapiq raises satisfies: an `@ebec/core` error carrying
 * a machine-readable {@link ErrorCode} and the trace it was raised from.
 */
export interface IBaseError extends IError {
    readonly code : ErrorCodeInput,
    readonly issues : readonly Issue[],
}

/**
 * A client-input failure, as consumers see it.
 */
export interface IParseError extends IBaseError {}

/**
 * What `JSON.stringify` emits for a rapiq error.
 *
 * `issues` is the point of it: an error that crosses a boundary without its
 * trace has nothing to say on the far side. The `@instanceof` chain rides
 * along so `isBaseError` / `isParseError` still recognize the value once it is
 * a plain object: the guards match the serialized chain, not just a live
 * brand. Issue `expected` and `received` members are omitted at runtime even
 * though @ebec/core's optional members keep this structural type assignable.
 */
export type SerializedError = {
    name: string,
    message: string,
    code: ErrorCodeInput,
    issues: readonly Issue[],
    cause?: unknown,
    '@instanceof': string[],
};

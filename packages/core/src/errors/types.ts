/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorCode } from './code';
import type { Issue } from 'blemish';

export type BaseErrorOptions = {
    code?: `${ErrorCode}`,
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
 * The shape every error rapiq raises satisfies: a native `Error` carrying a
 * machine-readable {@link ErrorCode} and the trace it was raised from.
 */
export interface IBaseError extends Error {
    readonly code : `${ErrorCode}`,
    readonly issues : readonly Issue[],
}

/**
 * A client-input failure, as consumers see it.
 */
export interface IParseError extends IBaseError {}

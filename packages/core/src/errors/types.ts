/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorCode } from './code';
import type { Issue } from './issue';

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

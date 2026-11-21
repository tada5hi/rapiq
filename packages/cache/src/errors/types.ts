/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BaseErrorOptions } from '@rapiq/core';

export type CacheErrorOptions = BaseErrorOptions & {
    /**
     * The tags a failed or dropped invalidation concerned.
     */
    tags?: string[],
};

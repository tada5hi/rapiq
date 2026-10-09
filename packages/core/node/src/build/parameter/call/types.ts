/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * A term as a caller builds it: `{ name: 'bucket', params: ['createdAt', 'day'] }`
 * is `bucket(createdAt,day)` on the wire. A bare string is a term
 * without arguments.
 */
export type CallBuildInput = {
    name: string,
    params?: string[],
};

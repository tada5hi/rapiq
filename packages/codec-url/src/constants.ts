/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * JSON-API wire names of the query parameters,
 * as they appear in a URL query string.
 */
export enum URLParameter {
    FILTERS = 'filter',
    FIELDS = 'fields',
    PAGINATION = 'page',
    RELATIONS = 'include',
    SORT = 'sort',
}

/**
 * Reserved wire parameter carrying the codec identity of a payload.
 * Encoding through the facade stamps it; decoding dispatches on it.
 * When absent, registered dialects recognize their payloads
 * structurally via their `detect` hooks (the bundled setup tells
 * expression and legacy simple input apart by the filter wire shape).
 */
export const CODEC_PARAMETER = 'codec';

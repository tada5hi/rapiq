/*
 * Copyright (c) 2025-2025.
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
 * Stable identifier of this codec (wire dialect), e.g. for the
 * in-band `codec` parameter dispatched by the URL codec facade or an
 * out-of-band content-negotiation header.
 *
 * @deprecated For encoding, the simple dialect is retained for the v2
 * migration only. The identifier remains valid when recognizing legacy
 * input. Prefer expression encoding, which is the default.
 */
export const URL_SIMPLE_CODEC = 'url-simple';

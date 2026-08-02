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

/**
 * Wire spelling of the root field group when root and relation
 * fieldsets encode together: `fields[$root]=id&fields[realm]=name`.
 * A lone root group keeps the bare form (`fields=id`). Core's
 * internal DEFAULT_ID sentinel never appears on the wire; decoding
 * additionally accepts the legacy `__DEFAULT__` spelling written by
 * the 2.0 betas.
 */
export const URL_FIELDS_ROOT = '$root';

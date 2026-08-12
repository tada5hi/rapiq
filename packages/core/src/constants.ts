/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum Parameter {
    FILTERS = 'filters',
    FIELDS = 'fields',
    PAGINATION = 'pagination',
    RELATIONS = 'relations',
    SORTS = 'sorts',
    /**
     * @deprecated use {@link Parameter.SORTS}. The value stays `sort`,
     * so `parameters` masks and `describe()` output keep working.
     * Removed in 3.0.
     */
    SORT = 'sort',
}

// -----------------------------------------------------------

export const DEFAULT_ID = '__DEFAULT__';

// -----------------------------------------------------------

/**
 * Shared upper bound for recursive traversal: schema relation
 * resolution, expression compound nesting and mongo document
 * nesting all consume this cap, so every dialect accepts and
 * rejects the same depth.
 */
export const MAX_TRAVERSAL_DEPTH = 32;

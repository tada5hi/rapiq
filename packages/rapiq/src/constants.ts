/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

// -----------------------------------------------------------

export enum Parameter {
    FILTERS = 'filters',
    FIELDS = 'fields',
    PAGINATION = 'pagination',
    RELATIONS = 'relations',
    SORT = 'sort',
}

// -----------------------------------------------------------

export enum URLParameter {
    FILTERS = 'filter',
    FIELDS = 'fields',
    PAGINATION = 'page',
    RELATIONS = 'include',
    SORT = 'sort',
}

// -----------------------------------------------------------

export const DEFAULT_ID = '__DEFAULT__';

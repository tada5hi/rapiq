/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteralKeys } from '../types';
import type { Parameter } from '../constants';
import type { Fields } from './fields';
import type { Filters } from './filters';
import type { Relations } from './relations';
import type { Pagination } from './pagination';
import type { Sorts } from './sort';

export type Query = ObjectLiteralKeys<{
    [Parameter.FIELDS]?: Fields,
    [Parameter.FILTERS]?: Filters,
    [Parameter.RELATIONS]?: Relations,
    [Parameter.PAGINATION]?: Pagination,
    [Parameter.SORT]?: Sorts,
}>;

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFieldsAdapter } from './fields';
import type { IFiltersAdapter } from './filters';
import type { IPaginationAdapter } from './pagination';
import type { IRelationsAdapter } from './relations';
import type { ISortAdapter } from './sort';

export interface IAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> {
    withQuery(query?: QUERY): void;
    execute() : void;
    clear() : void;
}

export interface IRootAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
    relations : IRelationsAdapter<QUERY>;

    fields : IFieldsAdapter<QUERY>;

    filters : IFiltersAdapter<QUERY>;

    pagination : IPaginationAdapter<QUERY>;

    sort : ISortAdapter<QUERY>;
}

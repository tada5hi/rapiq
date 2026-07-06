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

/**
 * Clause fragments accumulated from a Query walk.
 * Statement assembly (FROM/JOIN conditions) is owned by the caller,
 * which knows the table layout — rapiq only knows relation names.
 */
export type SqlFragments = {
    /**
     * Escaped selection columns, e.g. ['"user"."id"', '"realm"."name"'].
     */
    columns: string[],
    /**
     * Joined WHERE condition ('' when no filters apply).
     */
    where: string,
    /**
     * Bound parameters for `where`.
     */
    params: unknown[],
    /**
     * Escaped ORDER BY entries, e.g. ['"user"."age" DESC'].
     */
    orderBy: string[],
    limit: number | undefined,
    offset: number | undefined,
    /**
     * Canonical relation paths to join (parents included),
     * e.g. ['items', 'items.realm'].
     */
    relations: string[],
};

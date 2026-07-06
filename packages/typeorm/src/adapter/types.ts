/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapterBaseOptions } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export type RelationsAdapterJoinType = 'left' | 'inner';

export type RelationsAdapterOptions<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> = RelationsAdapterBaseOptions & {
    /**
     * Join strategy for relations.
     * Defaults to 'left' so records with absent relations are kept
     * (matches typeorm-extension's leftJoinAndSelect behavior).
     */
    joinType?: RelationsAdapterJoinType,

    /**
     * Invoked for every join this adapter applies (skipped joins,
     * e.g. pre-existing ones, do not trigger it). Useful to extend
     * the query per join, e.g. `query.addGroupBy(`${alias}.id`)`.
     */
    onJoin?: (path: string, alias: string, query: QUERY) => void,
};

export type TypeormAdapterOptions<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> = {
    relations?: RelationsAdapterOptions<QUERY>
};

export type TypeormAdapterOutput = {
    /**
     * The pagination actually applied to the query builder,
     * e.g. for the response meta block.
     */
    pagination: {
        limit: number | undefined,
        offset: number | undefined,
    }
};

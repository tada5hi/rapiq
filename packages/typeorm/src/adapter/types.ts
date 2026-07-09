/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapterBaseOptions } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export type RelationsAdapterJoinType = 'left' | 'inner';

export type RelationsAdapterOptions = RelationsAdapterBaseOptions & {
    /**
     * Join strategy for relations.
     * Defaults to 'left' so records with absent relations are kept
     * (matches typeorm-extension's leftJoinAndSelect behavior).
     */
    joinType?: RelationsAdapterJoinType,

    /**
     * Invoked for every join this adapter applies (skipped joins,
     * e.g. pre-existing ones, do not trigger it). Useful to extend
     * the query per join, e.g. `queryBuilder.addGroupBy(`${alias}.id`)`.
     */
    onJoin?: (path: string, alias: string, queryBuilder: SelectQueryBuilder<any>) => void,
};

export type TypeormAdapterOptions = {
    /**
     * The query builder to apply the parsed query to.
     */
    queryBuilder?: SelectQueryBuilder<any>,
    relations?: RelationsAdapterOptions,
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

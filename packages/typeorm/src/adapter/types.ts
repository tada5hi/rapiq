/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { RelationsAdapterBaseOptions } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';

export type RelationsAdapterJoinType = 'left' | 'inner';

/**
 * How much of a hydrated relation is selected.
 *
 * - `'full'` (default): the whole subtree — every column of the joined
 *   relation is selected (`leftJoinAndSelect`), matching the
 *   `@rapiq/memory` projection contract.
 * - `'key'`: only the relation's primary key column(s) — a plain
 *   `leftJoin` plus `addSelect(<alias>.<pk>)`, so the relation object is
 *   hydrated **id-only**. Use this to keep an `include`d relation defined
 *   under `GROUP BY <root>.id` on strict dialects (postgres), where the
 *   full subtree's non-grouped columns are rejected.
 */
export type RelationsAdapterHydrationMode = 'full' | 'key';

export type RelationsAdapterOptions = RelationsAdapterBaseOptions & {
    /**
     * Join strategy for relations.
     * Defaults to 'left' so records with absent relations are kept
     * (matches typeorm-extension's leftJoinAndSelect behavior).
     */
    joinType?: RelationsAdapterJoinType,

    /**
     * Select granularity for relations the adapter hydrates (both
     * `include`d relations and, with `joinAndSelect`, every joined one).
     * Defaults to `'full'` (whole subtree). Set to `'key'` to select only
     * the primary key so a hydrated relation survives `GROUP BY <root>.id`
     * on strict dialects — see {@link RelationsAdapterHydrationMode}.
     */
    hydrationMode?: RelationsAdapterHydrationMode,

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
    queryBuilder: SelectQueryBuilder<any>,
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

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery } from '@rapiq/core';
import type { VisitorOptions } from '../visitor/types';
import type { IFieldsAdapter } from './fields';
import type { IFiltersAdapter } from './filters';
import type { IPaginationAdapter } from './pagination';
import type { IRelationsAdapter } from './relations';
import type { ISortAdapter } from './sort';

/**
 * Options for a single {@link IRootAdapter.execute} call.
 */
export type ExecuteOptions = {
    /**
     * Reset the accumulated state before walking the query.
     *
     * `true` (default) makes execute() self-contained and re-runnable;
     * pass `false` to accumulate across multiple execute() calls.
     */
    clear?: boolean,

    /**
     * Options forwarded to the {@link QueryVisitor} (and its sub-visitors)
     * that walks the query.
     */
    visitor?: VisitorOptions,
};

/**
 * Shared contract for the per-parameter sub-adapters that accumulate
 * clause state while a query is walked, then flush it on {@link execute}.
 */
export interface ISubAdapter {
    execute() : void;
    clear() : void;
}

/**
 * Root adapter contract: walks a rapiq {@link IQuery} into the sub-adapters
 * and emits the backend result — SQL fragments, or the echo of a mutated
 * backend query object.
 */
export interface IRootAdapter<
    OUTPUT = unknown,
> {
    relations : IRelationsAdapter;

    fields : IFieldsAdapter;

    filters : IFiltersAdapter;

    pagination : IPaginationAdapter;

    sort : ISortAdapter;

    /**
     * Walk `query` into the sub-adapters and emit the backend result.
     *
     * @param query   the parsed rapiq query (AST) to consume.
     * @param options per-call options ({@link ExecuteOptions}).
     */
    execute(query: IQuery, options?: ExecuteOptions): OUTPUT;

    clear() : void;
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

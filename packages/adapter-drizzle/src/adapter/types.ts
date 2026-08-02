/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IMetadata } from '../metadata';
import type { Provider, ProviderOptions } from '../provider';

/**
 * A drizzle relational `where` filter object: an untyped record by
 * construction, since the adapter emits plain objects and never
 * imports drizzle's generated types.
 */
export type Where = Record<string, any>;

/**
 * The subset of a relational `findMany` config object rapiq
 * populates. Assignable to `db.query.<table>.findMany(...)`'s
 * argument; bind the concrete config type through
 * {@link DrizzleAdapter}'s type parameter to keep the call site
 * checked.
 */
export type FindManyConfig = {
    where?: Where,
    columns?: Record<string, boolean>,
    with?: Record<string, any>,
    orderBy?: Record<string, 'asc' | 'desc'>,
    limit?: number,
    offset?: number,
};

// -----------------------------------------------------------

export type FiltersAdapterOptions = {
    /**
     * Field keys whose equality comparisons (eq/ne/in/nin) stay
     * case-sensitive instead of the case-insensitive default.
     * Typically forwarded from a schema's `filters.caseSensitive`.
     */
    caseSensitive?: string[] | boolean,
};

export type DrizzleAdapterOptions = {
    /**
     * Dialect the emitted config will execute against, or an explicit
     * capability preset. Decides whether `ilike` may be emitted and
     * whether LIKE operands can be escaped; a wrong answer breaks
     * case-insensitive filters, so there is no default to guess.
     */
    provider: `${Provider}` | ProviderOptions,

    /**
     * Table metadata: which paths are relations, which of those are
     * to-many, which columns can hold null and which hold strings.
     * Build it with `defineMetadata()`.
     *
     * Required: the adapter is bound to one table anyway, and every
     * one of these facts changes what a correct drizzle filter looks
     * like. Guessing them produces wrong result sets, not graceful
     * degradation.
     */
    metadata: IMetadata,

    filters?: FiltersAdapterOptions,
};

// -----------------------------------------------------------

export type ExecuteOptions<CONFIG extends FindManyConfig = FindManyConfig> = {
    /**
     * Application-owned baseline config, e.g. a tenant or
     * authorization scope. The rapiq `where` is **conjoined** with
     * `base.where`, never substituted for it; every other baseline
     * key survives unless the query produces one itself.
     */
    base?: CONFIG,

    filters?: FiltersAdapterOptions,
};

export type DrizzleAdapterOutput<CONFIG extends FindManyConfig = FindManyConfig> = {
    /**
     * The config object to hand to `db.query.<table>.findMany()`.
     */
    config: CONFIG,

    /**
     * The pagination applied from the query (schema-clamped), e.g.
     * for the response meta block. Deliberately echoes the query
     * alone, matching the other adapters: a baseline `limit`/`offset`
     * and the impossible-root `limit: 0` cap are config concerns, not
     * something a meta block should report.
     */
    pagination: {
        limit: number | undefined,
        offset: number | undefined,
    },
};

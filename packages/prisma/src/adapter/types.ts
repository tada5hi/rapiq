/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IMetadata } from '../metadata';
import type { Provider, ProviderOptions } from '../provider';

/**
 * A prisma `where` input: an untyped record by construction, since
 * the adapter emits plain objects and never imports prisma's
 * generated types.
 */
export type Where = Record<string, any>;

/**
 * The subset of a `findMany` argument object rapiq populates.
 * Assignable to the generated `Prisma.<Model>FindManyArgs`; bind that
 * type through {@link PrismaAdapter}'s type parameter to keep the
 * call site checked.
 */
export type Args = {
    where?: Where,
    select?: Record<string, any>,
    include?: Record<string, any>,
    orderBy?: Record<string, any>[],
    take?: number,
    skip?: number,
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

export type PrismaAdapterOptions = {
    /**
     * Datasource provider of the targeted prisma client, or an
     * explicit capability preset. Decides whether
     * `mode: 'insensitive'` may be emitted; a wrong answer is a
     * prisma validation error on every case-insensitive filter, so
     * there is no default to guess.
     */
    provider: `${Provider}` | ProviderOptions,

    /**
     * Model metadata: which paths are relations, which of those are
     * to-many, which columns can hold null and which hold strings.
     * Build it from a prisma datamodel with `defineMetadata()`.
     *
     * Required: the adapter is bound to one model anyway, and every
     * one of these facts changes what a valid prisma filter looks
     * like. Guessing them produces runtime validation errors, not
     * graceful degradation.
     */
    metadata: IMetadata,

    filters?: FiltersAdapterOptions,
};

// -----------------------------------------------------------

export type ExecuteOptions<ARGS extends Args = Args> = {
    /**
     * Application-owned baseline arguments, e.g. a tenant or
     * authorization scope. The rapiq `where` is **conjoined** with
     * `base.where`, never substituted for it; every other baseline
     * key survives unless the query produces one itself.
     */
    base?: ARGS,

    filters?: FiltersAdapterOptions,
};

export type PrismaAdapterOutput<ARGS extends Args = Args> = {
    /**
     * The argument object to hand to `prisma.<model>.findMany()`.
     */
    args: ARGS,

    /**
     * The pagination actually applied, e.g. for the response meta
     * block.
     */
    pagination: {
        limit: number | undefined,
        offset: number | undefined,
    },
};

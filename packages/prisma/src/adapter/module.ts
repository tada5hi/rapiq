/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery, IQueryVisitor } from '@rapiq/core';
import { AdapterError, ErrorCode } from '@rapiq/core';
import type { IMetadata } from '../metadata';
import { defineMetadata, resolveDelegateClient, resolveModelName } from '../metadata';
import type { ProviderOptions } from '../provider';
import { resolveClientProvider, resolveProviderOptions } from '../provider';
import { buildSelection } from './fields';
import { mergeArgs } from './merge';
import { collectRelationPaths } from './relations';
import { buildOrderBy } from './sort';
import { WhereRenderer } from './where';
import type {
    ApplyOutput,
    Args,
    ExecuteOptions,
    PrismaAdapterClientOptions,
    PrismaAdapterOptions,
    PrismaAdapterOutput,
} from './types';

/**
 * Resolve the client-bound options shape: the client comes from the
 * delegate's runtime backref (or explicitly), metadata from its
 * runtime datamodel and the provider from its active connector, each
 * overridable.
 */
function resolveClientOptions(options: PrismaAdapterClientOptions) : {
    metadata: IMetadata,
    provider: ProviderOptions,
} {
    const client = options.client ?? resolveDelegateClient(options.model);

    if (!client && !(options.metadata && options.provider)) {
        throw new AdapterError({
            message: 'The client could not be resolved from the model delegate; ' +
                'pass it explicitly.',
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    return {
        metadata: options.metadata ?? defineMetadata(client as object, options.model),
        provider: resolveProviderOptions(
            options.provider ?? resolveClientProvider(client as object),
        ),
    };
}

/**
 * The delegate to run against: the model itself when one was passed,
 * otherwise the client property named after the model (prisma
 * lowercases exactly the first letter: `RoleDetail` becomes
 * `client.roleDetail`).
 */
function resolveDelegate(options: PrismaAdapterClientOptions, client?: object) : Record<string, any> | undefined {
    if (typeof options.model === 'object' && options.model !== null) {
        const delegate = options.model as Record<string, any>;

        // a delegate that cannot run is not a binding: leaving it
        // unbound keeps the runners' typed error instead of a raw
        // TypeError from inside findMany.
        return typeof delegate.findMany === 'function' ? delegate : undefined;
    }

    if (!client) {
        return undefined;
    }

    const name = resolveModelName(options.model);
    const property = name.charAt(0).toLowerCase() + name.slice(1);
    const delegate = (client as Record<string, any>)[property];

    if (delegate && typeof delegate.findMany === 'function') {
        return delegate;
    }

    return undefined;
}

/**
 * Serializes a parsed query into a prisma `findMany` argument object.
 *
 * A pure serializer: `execute` maps a value to a value, holds no
 * per-call state, and one instance is safely shared across requests.
 * Queries compose BEFORE serialization (`mergeQueries`,
 * `query.filters.and(...)` in `@rapiq/core`), which is why there is
 * no accumulation API. Nothing from prisma is imported; bind the
 * generated argument type to keep the call site checked:
 *
 * ```typescript
 * const adapter = new PrismaAdapter<Prisma.UserFindManyArgs>({
 *     provider: 'postgresql',
 *     metadata: defineMetadata(Prisma.dmmf.datamodel, 'User'),
 * });
 *
 * const { args, pagination } = adapter.execute(query);
 * const users = await prisma.user.findMany(args);
 * ```
 */
export class PrismaAdapter<
    ARGS extends Args = Args,
> implements IQueryVisitor<PrismaAdapterOutput<ARGS>> {
    protected renderer : WhereRenderer;

    protected options : PrismaAdapterOptions;

    protected model : Record<string, any> | undefined;

    constructor(options: PrismaAdapterOptions) {
        this.options = options;

        if ('model' in options) {
            const resolved = resolveClientOptions(options);

            this.renderer = new WhereRenderer(
                resolved.metadata,
                resolved.provider,
            );

            this.model = resolveDelegate(
                options,
                options.client ?? resolveDelegateClient(options.model),
            );

            return;
        }

        this.renderer = new WhereRenderer(
            options.metadata,
            resolveProviderOptions(options.provider),
        );
    }

    // -----------------------------------------------------------

    execute(
        query: IQuery,
        options: ExecuteOptions<ARGS> = {},
    ) : PrismaAdapterOutput<ARGS> {
        const base = options.base as Args | undefined;

        const filters = this.renderer.build(
            query.filters,
            options.filters || this.options.filters || {},
        );

        const produced : Args = {};

        if (!filters.impossible && filters.where) {
            produced.where = filters.where;
        }

        Object.assign(
            produced,
            buildSelection(query.fields, collectRelationPaths(query.relations)),
        );

        const orderBy = buildOrderBy(query.sorts);
        if (orderBy.length > 0) {
            produced.orderBy = orderBy;
        }

        // a query without pagination leaves caller-owned take/skip
        // untouched. Nullish (not falsy) checks: an explicit 0 is a
        // value, not absence.
        const { limit, offset } = query.pagination;

        if (typeof limit !== 'undefined') {
            produced.take = limit;
        }

        if (typeof offset !== 'undefined') {
            produced.skip = offset;
        }

        const args = base ? mergeArgs(base, produced) : produced;

        if (filters.impossible) {
            // `{ OR: [] }` is prisma's `1 = 0`, but only at the ROOT;
            // a nested empty group is stripped, so this cannot go
            // through the generic where conjunction. Sibling operator
            // keys are conjoined, so a caller-owned predicate rides
            // along instead of being dropped.
            args.where = base && base.where ?
                { OR: [], AND: [base.where] } :
                { OR: [] };
        }

        return {
            args: args as ARGS,
            pagination: { limit, offset },
        };
    }

    visitQuery(expr: IQuery) : PrismaAdapterOutput<ARGS> {
        return this.execute(expr);
    }

    // -----------------------------------------------------------

    /**
     * Serialize and run in one step: `execute` piped into the bound
     * model's `findMany`. Only available on a model-bound adapter,
     * the counterpart of the typeorm adapter applying its state to
     * the bound query builder.
     */
    async findMany<T = Record<string, any>>(
        query: IQuery,
        options: ExecuteOptions<ARGS> = {},
    ) : Promise<T[]> {
        const { args } = this.execute(query, options);

        return this.delegate().findMany(args);
    }

    /**
     * Records matching the query's filters (and the baseline `where`),
     * BEFORE pagination: the total a response meta block reports.
     */
    async count(
        query: IQuery,
        options: ExecuteOptions<ARGS> = {},
    ) : Promise<number> {
        const { args } = this.execute(query, options);

        return this.delegate().count(args.where ? { where: args.where } : {});
    }

    /**
     * The whole request in one call: rows and the pre-pagination
     * total, shaped like `@rapiq/memory`'s `applyQuery`.
     */
    async apply<T = Record<string, any>>(
        query: IQuery,
        options: ExecuteOptions<ARGS> = {},
    ) : Promise<ApplyOutput<T>> {
        const { args, pagination } = this.execute(query, options);

        const model = this.delegate();

        const [data, total] = await Promise.all([
            model.findMany(args),
            model.count(args.where ? { where: args.where } : {}),
        ]);

        return {
            data, 
            total, 
            pagination, 
        };
    }

    protected delegate() : Record<string, any> {
        if (!this.model) {
            throw new AdapterError({
                message: 'The adapter is not bound to a model; ' +
                    'construct it with `{ model }` to run queries.',
                code: ErrorCode.FEATURE_UNSUPPORTED,
            });
        }

        return this.model;
    }
}

// -----------------------------------------------------------

/**
 * One-shot convenience over {@link PrismaAdapter}.
 */
export function buildPrismaArgs<ARGS extends Args = Args>(
    query: IQuery,
    options: PrismaAdapterOptions & ExecuteOptions<ARGS>,
) : PrismaAdapterOutput<ARGS> {
    return new PrismaAdapter<ARGS>(options).execute(query, options);
}

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery, IQueryVisitor } from '@rapiq/core';
import { AdapterError, ErrorCode } from '@rapiq/core';
import type { IMetadata } from '../metadata';
import { defineMetadata, resolveDelegateClient } from '../metadata';
import type { ProviderOptions } from '../provider';
import { resolveClientProvider, resolveProviderOptions } from '../provider';
import { buildSelection } from './fields';
import { collectRelationPaths } from './relations';
import { buildOrderBy } from './sort';
import { WhereRenderer } from './where';
import type {
    Args,
    ExecuteOptions,
    PrismaAdapterClientOptions,
    PrismaAdapterOptions,
    PrismaAdapterOutput,
    Where,
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

    constructor(options: PrismaAdapterOptions) {
        this.options = options;

        if ('model' in options) {
            const resolved = resolveClientOptions(options);

            this.renderer = new WhereRenderer(
                resolved.metadata,
                resolved.provider,
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
        const args = { ...(base || {}) } as Args;

        const filters = this.renderer.build(
            query.filters,
            options.filters || this.options.filters || {},
        );

        const where = this.buildWhere(filters, base?.where);
        if (where) {
            args.where = where;
        }

        this.applySelection(
            args,
            buildSelection(query.fields, collectRelationPaths(query.relations)),
            base,
        );

        const orderBy = buildOrderBy(query.sorts);
        if (orderBy.length > 0) {
            args.orderBy = orderBy;
        }

        // a query without pagination leaves caller-owned take/skip
        // untouched. Nullish (not falsy) checks: an explicit 0 is a
        // value, not absence.
        const { limit, offset } = query.pagination;

        if (typeof limit !== 'undefined') {
            args.take = limit;
        }

        if (typeof offset !== 'undefined') {
            args.skip = offset;
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

    protected buildWhere(
        filters: { where?: Where, impossible: boolean },
        base?: Where,
    ) : Where | undefined {
        if (filters.impossible) {
            // `{ OR: [] }` is prisma's `1 = 0`, but only at the root;
            // a nested empty group is stripped. Sibling operator keys
            // are conjoined, so a caller-owned predicate rides along
            // instead of being dropped.
            return base ? { OR: [], AND: [base] } : { OR: [] };
        }

        const { where } = filters;

        if (!where) {
            return base;
        }

        if (!base) {
            return where;
        }

        // rapiq filters narrow the query; they never replace an
        // application-owned tenant or authorization predicate.
        return { AND: [base, where] };
    }

    /**
     * Prisma rejects `select` next to `include` (and next to `omit`)
     * on the same level, so exactly one of them survives.
     *
     * A baseline `select` is a deliberate projection restriction and
     * is therefore never dropped: relations the query hydrates join
     * it instead. Widening a caller-owned projection would expose
     * columns the application chose to withhold.
     */
    protected applySelection(
        args: Args,
        selection: { select?: Record<string, any>, include?: Record<string, any> },
        base?: Args,
    ) : void {
        if (selection.select) {
            args.select = selection.select;
            delete args.include;
            delete (args as Record<string, unknown>).omit;

            return;
        }

        if (!selection.include) {
            return;
        }

        if (base && base.select) {
            args.select = { ...base.select, ...selection.include };
            delete args.include;
            delete (args as Record<string, unknown>).omit;

            return;
        }

        args.include = selection.include;
        delete args.select;
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

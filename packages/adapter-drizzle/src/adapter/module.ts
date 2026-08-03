/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IQuery, IQueryVisitor } from '@rapiq/core';
import { resolveProviderOptions } from '../provider';
import { buildSelection } from './fields';
import { mergeConfig } from './merge';
import { collectRelationPaths } from './relations';
import { buildOrderBy } from './sort';
import { WhereRenderer } from './where';
import type {
    DrizzleAdapterOptions,
    DrizzleAdapterOutput,
    ExecuteOptions,
    FindManyConfig,
} from './types';

/**
 * Serializes a parsed query into a drizzle relational-queries v2
 * `findMany` config object.
 *
 * A pure serializer: `execute` maps a value to a value, holds no
 * per-call state, and one instance is safely shared across requests.
 * Queries compose BEFORE serialization (`mergeQueries`,
 * `query.filters.and(...)` in `@rapiq/core`), which is why there is
 * no accumulation API. Nothing from drizzle is imported; bind the
 * concrete config type to keep the call site checked:
 *
 * ```typescript
 * const adapter = new DrizzleAdapter({
 *     provider: 'pg',
 *     metadata: defineMetadata(datamodel, 'users'),
 * });
 *
 * const { config, pagination } = adapter.execute(query);
 * const users = await db.query.users.findMany(config);
 * ```
 */
export class DrizzleAdapter<
    CONFIG extends FindManyConfig = FindManyConfig,
> implements IQueryVisitor<DrizzleAdapterOutput<CONFIG>> {
    protected renderer : WhereRenderer;

    protected options : DrizzleAdapterOptions;

    constructor(options: DrizzleAdapterOptions) {
        this.options = options;

        this.renderer = new WhereRenderer(
            options.metadata,
            resolveProviderOptions(options.provider),
        );
    }

    // -----------------------------------------------------------

    execute(
        query: IQuery,
        options: ExecuteOptions<CONFIG> = {},
    ) : DrizzleAdapterOutput<CONFIG> {
        const base = options.base as FindManyConfig | undefined;

        const filters = this.renderer.build(
            query.filters,
            { caseSensitive: options.caseSensitive ?? this.options.caseSensitive },
        );

        const produced : FindManyConfig = {};

        if (!filters.impossible && filters.where) {
            produced.where = filters.where;
        }

        Object.assign(
            produced,
            buildSelection(
                query.fields,
                collectRelationPaths(query.relations),
                this.options.metadata,
            ),
        );

        const orderBy = buildOrderBy(query.sorts);
        if (Object.keys(orderBy).length > 0) {
            produced.orderBy = orderBy;
        }

        // a query without pagination leaves caller-owned limit/offset
        // untouched. Nullish (not falsy) checks: an explicit 0 is a
        // value, not absence.
        const { limit, offset } = query.pagination;

        if (typeof limit !== 'undefined') {
            produced.limit = limit;
        }

        if (typeof offset !== 'undefined') {
            produced.offset = offset;
        }

        const config = base ? mergeConfig(base, produced) : produced;

        if (filters.impossible) {
            // the filter object has no dialect-free `1 = 0` literal
            // (an empty group is stripped, not falsified), so an
            // impossible root is expressed through the config instead:
            // `limit: 0` returns no rows on every dialect, and a
            // caller-owned baseline cannot widen an unsatisfiable
            // condition.
            config.limit = 0;
        }

        return {
            config: config as CONFIG,
            pagination: { limit, offset },
        };
    }

    visitQuery(expr: IQuery) : DrizzleAdapterOutput<CONFIG> {
        return this.execute(expr);
    }
}

// -----------------------------------------------------------

/**
 * One-shot convenience over {@link DrizzleAdapter}.
 */
export function buildDrizzleConfig<CONFIG extends FindManyConfig = FindManyConfig>(
    query: IQuery,
    options: DrizzleAdapterOptions & ExecuteOptions<CONFIG>,
) : DrizzleAdapterOutput<CONFIG> {
    return new DrizzleAdapter<CONFIG>(options).execute(query, options);
}

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IQuery,
    ParseParameterOptions,
    ParseQueryOptions,
} from '@rapiq/core';

export type QueryParameterMask = {
    fields?: boolean,
    filters?: boolean,
    pagination?: boolean,
    relations?: boolean,
    sorts?: boolean,
};

/**
 * Which parameters are present on the input query. The schema-aware
 * encode pass re-emits only these, so validation cannot materialize
 * schema defaults for absent parameters onto the wire.
 *
 * @param input
 */
export function buildQueryParameterMask(input: IQuery) : QueryParameterMask {
    return {
        fields: input.fields.value.length > 0,
        filters: input.filters.value.length > 0,
        pagination: typeof input.pagination.limit !== 'undefined' ||
            typeof input.pagination.offset !== 'undefined',
        relations: input.relations.value.length > 0,
        sorts: input.sorts.value.length > 0,
    };
}

/**
 * The schema pass only runs on request — a registry alone
 * imposes no constraints (unbound scopes), matching the parsers.
 *
 * @param options
 */
export function isSchemaAware(options: ParseQueryOptions | ParseParameterOptions) : boolean {
    return typeof options.schema !== 'undefined' ||
        typeof options.strict !== 'undefined';
}

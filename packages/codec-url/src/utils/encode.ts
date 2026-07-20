/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '@rapiq/core';
import type {
    IQuery,
    ParseParameterOptions,
    ParseQueryOptions,
} from '@rapiq/core';

/**
 * Which parameters are present on the input query. The schema-aware
 * encode pass decodes only these (`ParseQueryOptions.parameters`),
 * so validation cannot materialize schema defaults for absent
 * parameters onto the wire.
 *
 * @param input
 */
export function buildQueryParameters(input: IQuery) : `${Parameter}`[] {
    const output : `${Parameter}`[] = [];

    if (input.fields.value.length > 0) {
        output.push(Parameter.FIELDS);
    }

    if (input.filters.value.length > 0) {
        output.push(Parameter.FILTERS);
    }

    if (
        typeof input.pagination.limit !== 'undefined' ||
        typeof input.pagination.offset !== 'undefined'
    ) {
        output.push(Parameter.PAGINATION);
    }

    if (input.relations.value.length > 0) {
        output.push(Parameter.RELATIONS);
    }

    if (input.sorts.value.length > 0) {
        output.push(Parameter.SORT);
    }

    return output;
}

/**
 * Restrict a parameter list by an optional caller-provided mask
 * ({@link ParseQueryOptions.parameters}).
 *
 * @param input
 * @param mask
 */
export function intersectQueryParameters(
    input: `${Parameter}`[],
    mask?: `${Parameter}`[],
) : `${Parameter}`[] {
    if (typeof mask === 'undefined') {
        return input;
    }

    return input.filter(
        (parameter) => mask.includes(parameter),
    );
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

/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, normalizeParameter } from '@rapiq/core';
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
        output.push(Parameter.SORTS);
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

    const normalized = mask.map((parameter) => normalizeParameter(parameter));

    return input.filter(
        (parameter) => normalized.includes(normalizeParameter(parameter)),
    );
}

/**
 * Whether a parameter mask contains the given parameter, normalizing
 * every entry so the deprecated `sort` alias matches `Parameter.SORTS`
 * (and vice versa).
 *
 * @param mask
 * @param parameter
 */
export function includesParameter(
    mask: `${Parameter}`[],
    parameter: `${Parameter}`,
) : boolean {
    const normalized = normalizeParameter(parameter);

    return mask
        .map((item) => normalizeParameter(item))
        .includes(normalized);
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

/**
 * Options for the decode pass a schema-aware ENCODE runs internally.
 *
 * The trace is stripped: that pass validates output the caller is producing,
 * not input it received, and its issues would arrive in a sink the caller
 * opened to observe requests — reported against wire-shaped positions of a
 * query it just wrote. An encode that drops something says so by leaving it
 * out (or by throwing, under a `throwOnFailure` schema).
 *
 * @param options
 */
export function withoutIssues<
    T extends ParseQueryOptions | ParseParameterOptions,
>(options: T) : T {
    const {
        issues: _issues,
        issueCollector: _issueCollector,
        ...rest
    } = options;

    return rest as T;
}

/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import type { Relations } from '../parameter';
import type { Schema } from '../schema';
import type { ObjectLiteral } from '../types';

export type ParseParameterOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = IParserOptions & {
    schema?: Schema<RECORD> | string,
    relations?: Relations,
    strict?: boolean,
    /**
     * Caller-defined context forwarded to the schema validate hooks
     * (relations/fields/sort key validators, filters leaf validator).
     * Opaque to the parser.
     */
    context?: unknown,
};

export type ParseQueryOptions<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = {
    fields?: boolean,
    filters?: boolean,
    pagination?: boolean,
    relations?: boolean,
    sort?: boolean,
    /**
     * Process only the listed parameters. A parameter that is not
     * listed is neither parsed nor defaulted — the resulting query
     * leaves it empty, exactly as if neither the input nor the schema
     * had mentioned it (schema defaults such as `pagination.maxLimit`
     * do not materialize). When relations are masked out, relation
     * paths in the other parameters resolve as if the client had
     * requested no relations. Omitting the option processes all
     * parameters.
     */
    parameters?: `${Parameter}`[],
    schema?: Schema<RECORD> | string,
    /**
     * Strict-mode override: takes precedence over the schema-level setting.
     * Under strict mode a parameter without an explicit allow-list rejects
     * every client key instead of falling back to the syntactic name check.
     */
    strict?: boolean,
    /**
     * Caller-defined context (e.g. the authenticated actor) forwarded to
     * every schema validate hook this parse run invokes. Hooks receive
     * `undefined` when no context is supplied. Opaque to the parser;
     * typing happens at the schema definition site
     * (`defineSchema<RECORD, CONTEXT>`).
     */
    context?: unknown,
};

export type IParserOptions = {
    /** @deprecated Call parseAsync() instead of selecting execution mode in options. */
    async?: boolean,
};

export interface IParser<
    Input = any,
    Output = any,
    Options extends IParserOptions = IParserOptions,
> {
    parse(input: Input, options?: Options): Output;

    parseAsync(input: Input, options?: Options): Promise<Output>;
}

/**
 * Contract of a per-parameter sub-parser, as consumed by the
 * query parse orchestration.
 */
export interface IQueryParameterParser<Output = unknown> {
    parse<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options?: ParseParameterOptions<RECORD>): Output;

    parseAsync<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(input: unknown, options?: ParseParameterOptions<RECORD>): Promise<Output>;
}

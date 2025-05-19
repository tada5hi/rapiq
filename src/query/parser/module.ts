/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter, URLParameter } from '../../constants';
import type {
    FieldsParseOutput,
    FiltersParseOutput,
    PaginationParseOutput,
    ParseSession,
    RelationsParseOutput, SortParseOutput,
} from '../../parameter';
import {
    parseQueryFields, parseQueryFilters, parseQueryPagination,
    parseQueryRelations,
    parseQuerySort,
} from '../../parameter';
import type {
    Schema,
} from '../../schema';
import type { ObjectLiteral } from '../../types';
import { isPropertySet } from '../../utils';
import type { QueryParseInput, QueryParseOptions, QueryParseOutput } from './types';

export class QueryParser<T extends ObjectLiteral = ObjectLiteral> {
    protected schema : Schema<T>;

    constructor(schema: Schema<T>) {
        this.schema = schema;
    }

    parse(
        input: QueryParseInput,
        options: QueryParseOptions = {},
    ) : QueryParseOutput {
        const output : QueryParseOutput = {};
        if (this.schema.defaultPath) {
            output.defaultPath = this.schema.defaultPath;
        }

        const session : ParseSession = {
            registry: options.registry,
        };

        if (!this.skipParameter(options.relations)) {
            let relations: RelationsParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.RELATIONS, URLParameter.RELATIONS])) {
                // todo: parse parameter & url-parameter
                relations = this.parseRelations(
                    input[Parameter.RELATIONS] || input[URLParameter.RELATIONS],
                );
            } else if (this.hasParameterOptionDefault(this.schema.relations)) {
                // todo: this should be simplified
                relations = this.parseRelations(undefined, session);
            }

            if (typeof relations !== 'undefined') {
                output[Parameter.RELATIONS] = relations;
                session.relations = relations;
            }
        }

        if (!this.skipParameter(options.fields)) {
            let fields : FieldsParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.FIELDS, URLParameter.FIELDS])) {
                // todo: parse parameter & url-parameter
                fields = this.parseFields(
                    input[Parameter.FIELDS] || input[URLParameter.FIELDS],
                    session,
                );
            } else if (this.hasParameterOptionDefault(this.schema.fields)) {
                // todo: this should be simplified
                fields = this.parseFields(undefined, session);
            }

            if (typeof fields !== 'undefined') {
                output[Parameter.FIELDS] = fields;
            }
        }

        if (!this.skipParameter(options.filters)) {
            let filters : FiltersParseOutput | undefined;
            if (this.hasParameterData(input, [Parameter.FILTERS, URLParameter.FILTERS])) {
                // todo: parse parameter & url-parameter
                output[Parameter.FILTERS] = this.parseFilters(
                    input[Parameter.FILTERS] || input[URLParameter.FILTERS],
                    session,
                );
            } else if (this.hasParameterOptionDefault(this.schema.filters)) {
                // todo: this should be simplified
                filters = this.parseFilters(undefined, session);
            }

            if (typeof filters !== 'undefined') {
                output[Parameter.FILTERS] = filters;
            }
        }

        if (!this.skipParameter(options.pagination)) {
            let pagination : PaginationParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.PAGINATION, URLParameter.PAGINATION])) {
                // todo: parse parameter & url-parameter
                pagination = this.parsePagination(
                    input[Parameter.PAGINATION] || input[URLParameter.PAGINATION],
                );
            }

            if (typeof pagination !== 'undefined') {
                output[Parameter.PAGINATION] = pagination;
            }
        }

        if (!this.skipParameter(options.sort)) {
            let sort : SortParseOutput | undefined;

            if (this.hasParameterData(input, [Parameter.SORT, URLParameter.SORT])) {
                // todo: parse parameter & url-parameter
                sort = this.parseSort(
                    input[Parameter.SORT] || input[URLParameter.SORT],
                    session,
                );
            } else if (this.hasParameterOptionDefault(this.schema.sort)) {
                // todo: this should be simplified
                sort = this.parseSort(undefined, session);
            }

            if (typeof sort !== 'undefined') {
                output[Parameter.SORT] = sort;
            }
        }

        return output;
    }

    /**
     * Parse relations input parameter.
     *
     * @param input
     * @param session
     */
    parseRelations(
        input: unknown,
        session: ParseSession = {},
    ): RelationsParseOutput {
        return parseQueryRelations(
            input,
            this.schema.relations,
            session,
        );
    }

    /**
     * Parse fields input parameter.
     *
     * @param input
     * @param session
     */
    parseFields(
        input: unknown,
        session: ParseSession = {},
    ) : FieldsParseOutput {
        return parseQueryFields(
            input,
            this.schema.fields,
            session,
        );
    }

    /**
     * Parse filter(s) input parameter.
     *
     * @param input
     * @param session
     */
    parseFilters(
        input: unknown,
        session: ParseSession = {},
    ) : FiltersParseOutput {
        return parseQueryFilters(
            input,
            this.schema.filters,
            session,
        );
    }

    /**
     * Parse pagination input parameter.
     *
     * @param input
     */
    parsePagination(input: unknown) : PaginationParseOutput {
        return parseQueryPagination(
            input,
            this.schema.pagination,
        );
    }

    /**
     * Parse sort input parameter.
     *
     * @param input
     * @param session
     */
    parseSort(
        input: unknown,
        session: ParseSession = {},
    ) : SortParseOutput {
        return parseQuerySort(
            input,
            this.schema.sort,
            session,
        );
    }

    // --------------------------------------------------

    protected skipParameter(input?: boolean) : boolean {
        return typeof input === 'boolean' && !input;
    }

    protected hasParameterData(
        input: QueryParseInput,
        keys: (keyof QueryParseInput)[],
    ): boolean {
        for (let i = 0; i < keys.length; i++) {
            if (isPropertySet(input, keys[i])) {
                return true;
            }
        }

        return false;
    }

    protected hasParameterOptionDefault(input: Record<string, any>) : boolean {
        return typeof input.default !== 'undefined';
    }
}

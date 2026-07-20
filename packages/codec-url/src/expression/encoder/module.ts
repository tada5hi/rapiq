/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IFields,
    IFilters,
    IPagination,
    IQuery,
    IRelations,
    ISorts,
    ParseParameterOptions,
    ParseQueryOptions,
    SchemaRegistry,
} from '@rapiq/core';
import { Parameter } from '@rapiq/core';
import {
    SimpleURLEncoder,
} from '../../simple/encoder';
import { URLParameter } from '../../constants';
import { buildQueryParameters, intersectQueryParameters, isSchemaAware } from '../../utils';
import { ExpressionURLDecoder } from '../decoder';
import { serializeFiltersExpression } from './filters';

/**
 * URL encoder for the expression dialect: the filter parameter
 * carries a single function-call expression
 * (filter=and(eq(name,'John'),or(...))) — nested compounds are
 * first-class. The other four parameters share the simple
 * dialect's wire format.
 */
export class ExpressionURLEncoder {
    protected simple : SimpleURLEncoder;

    protected decoder : ExpressionURLDecoder;

    constructor(
        input?: SchemaRegistry,
        context: {
            simple?: SimpleURLEncoder,
            decoder?: ExpressionURLDecoder,
        } = {},
    ) {
        this.simple = context.simple || new SimpleURLEncoder(input);
        this.decoder = context.decoder || new ExpressionURLDecoder(input);
    }

    /**
     * Encode a query to its wire format. When a schema (or strict
     * mode) is provided, the emitted output is validated the same
     * way the server-side decoder would treat it (see the simple
     * codec — identical semantics, expression filter syntax).
     *
     * @param input
     * @param options
     */
    encode(input: IQuery, options: ParseQueryOptions = {}): string | null {
        const encoded = this.encodeParts(input, options.parameters);
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        // decode only parameters present in the input — validation
        // must not materialize schema defaults for absent ones.
        const parameters = intersectQueryParameters(
            buildQueryParameters(input),
            options.parameters,
        );

        const decoded = this.decoder.decode(encoded, { ...options, parameters });
        if (!decoded) {
            return null;
        }

        return this.encodeParts(decoded, parameters);
    }

    async encodeAsync(
        input: IQuery,
        options: ParseQueryOptions = {},
    ) : Promise<string | null> {
        const encoded = this.encodeParts(input, options.parameters);
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const parameters = intersectQueryParameters(
            buildQueryParameters(input),
            options.parameters,
        );

        const decoded = await this.decoder.decodeAsync(encoded, { ...options, parameters });
        if (!decoded) {
            return null;
        }

        return this.encodeParts(decoded, parameters);
    }

    encodeFields(input: IFields, options: ParseParameterOptions = {}) {
        return this.simple.encodeFields(input, options);
    }

    encodeFilters(input: IFilters, options: ParseParameterOptions = {}) : string | null {
        const encoded = this.serializeFilters(input);
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeFilters(encoded, options);
        if (!decoded) {
            return null;
        }

        return this.serializeFilters(decoded);
    }

    async encodeFiltersAsync(
        input: IFilters,
        options: ParseParameterOptions = {},
    ) : Promise<string | null> {
        const encoded = this.serializeFilters(input);
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = await this.decoder.decodeFiltersAsync(encoded, options);
        if (!decoded) {
            return null;
        }

        return this.serializeFilters(decoded);
    }

    encodePagination(input: IPagination, options: ParseParameterOptions = {}) {
        return this.simple.encodePagination(input, options);
    }

    encodeRelations(input: IRelations, options: ParseParameterOptions = {}) {
        return this.simple.encodeRelations(input, options);
    }

    encodeSort(input: ISorts, options: ParseParameterOptions = {}) {
        return this.simple.encodeSort(input, options);
    }

    // --------------------------------------------------

    protected encodeParts(query: IQuery, parameters?: `${Parameter}`[]) : string | null {
        const parts = [
            (!parameters || parameters.includes(Parameter.FIELDS)) ?
                this.simple.encodeFields(query.fields) :
                null,
            (!parameters || parameters.includes(Parameter.FILTERS)) ?
                this.serializeFilters(query.filters) :
                null,
            (!parameters || parameters.includes(Parameter.PAGINATION)) ?
                this.simple.encodePagination(query.pagination) :
                null,
            (!parameters || parameters.includes(Parameter.RELATIONS)) ?
                this.simple.encodeRelations(query.relations) :
                null,
            (!parameters || parameters.includes(Parameter.SORT)) ?
                this.simple.encodeSort(query.sorts) :
                null,
        ].filter(Boolean);

        if (parts.length === 0) {
            return null;
        }

        return parts.join('&');
    }

    protected serializeFilters(input: IFilters) : string | null {
        const expression = serializeFiltersExpression(input);
        if (expression === null) {
            return null;
        }

        return `${URLParameter.FILTERS}=${encodeURIComponent(expression)}`;
    }
}

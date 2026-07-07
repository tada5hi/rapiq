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
import {
    URLEncoder as SimpleURLEncoder,
    URLParameter,
} from '@rapiq/codec-url-simple';
import { URLDecoder } from '../decoder';
import { serializeFiltersExpression } from './filters';

type QueryParameterMask = {
    fields?: boolean,
    filters?: boolean,
    pagination?: boolean,
    relations?: boolean,
    sorts?: boolean,
};

/**
 * URL encoder for the expression dialect: the filter parameter
 * carries a single function-call expression
 * (filter=and(eq(name,'John'),or(...))) — nested compounds are
 * first-class. The other four parameters share the simple
 * dialect's wire format.
 */
export class URLEncoder {
    protected simple : SimpleURLEncoder;

    protected decoder : URLDecoder;

    constructor(input?: SchemaRegistry) {
        this.simple = new SimpleURLEncoder();
        this.decoder = new URLDecoder(input);
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
        const encoded = this.encodeParts(input);
        if (encoded === null || !this.isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decode(encoded, options);
        if (!decoded) {
            return null;
        }

        // re-emit only parameters present in the input — validation
        // must not materialize schema defaults for absent ones.
        return this.encodeParts(decoded, {
            fields: input.fields.value.length > 0,
            filters: input.filters.value.length > 0,
            pagination: typeof input.pagination.limit !== 'undefined' ||
                typeof input.pagination.offset !== 'undefined',
            relations: input.relations.value.length > 0,
            sorts: input.sorts.value.length > 0,
        });
    }

    encodeFields(input: IFields, options: ParseParameterOptions = {}) {
        return this.simple.encodeFields(input, options);
    }

    encodeFilters(input: IFilters, options: ParseParameterOptions = {}) : string | null {
        const encoded = this.serializeFilters(input);
        if (encoded === null || !this.isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeFilters(encoded, options);
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

    protected encodeParts(query: IQuery, parameters?: QueryParameterMask) : string | null {
        const parts = [
            (!parameters || parameters.fields) ?
                this.simple.encodeFields(query.fields) :
                null,
            (!parameters || parameters.filters) ?
                this.serializeFilters(query.filters) :
                null,
            (!parameters || parameters.pagination) ?
                this.simple.encodePagination(query.pagination) :
                null,
            (!parameters || parameters.relations) ?
                this.simple.encodeRelations(query.relations) :
                null,
            (!parameters || parameters.sorts) ?
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

    protected isSchemaAware(options: ParseQueryOptions | ParseParameterOptions) : boolean {
        return typeof options.schema !== 'undefined' ||
            typeof options.strict !== 'undefined';
    }
}

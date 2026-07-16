/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IField,
    IFields,
    IFilter,
    IFilters,
    IPagination,
    IQuery,
    IRelations,
    ISorts,
    ParseParameterOptions,
    ParseQueryOptions,
    SchemaRegistry,
} from '@rapiq/core';
import { buildQueryParameterMask, isSchemaAware } from '../../utils';
import { SimpleURLDecoder } from '../decoder';
import type { ISerializer } from './serializer';
import { QueryVisitor } from './visitors';

export class SimpleURLEncoder {
    protected visitor : QueryVisitor;

    protected decoder : SimpleURLDecoder;

    constructor(
        input?: SchemaRegistry,
        context: { decoder?: SimpleURLDecoder } = {},
    ) {
        this.visitor = new QueryVisitor();
        this.decoder = context.decoder || new SimpleURLDecoder(input);
    }

    /**
     * Encode a query to its wire format. When a schema (or strict
     * mode) is provided, the emitted output is validated the same
     * way the server-side decoder would treat it: disallowed keys
     * are dropped, schema mappings/defaults/clamps are applied, and
     * `throwOnFailure` (on the schema) opts into throwing instead —
     * early client-side feedback with exact parser semantics.
     *
     * @param input
     * @param options
     */
    encode(input: IQuery, options: ParseQueryOptions = {}): string | null {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitQuery(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decode(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        // re-emit only parameters present in the input — validation
        // must not materialize schema defaults for absent ones.
        return this.runSerializer(
            this.visitor.visitQuery(decoded, buildQueryParameterMask(input)),
        );
    }

    async encodeAsync(
        input: IQuery,
        options: ParseQueryOptions = {},
    ) : Promise<string | null> {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitQuery(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = await this.decoder.decodeAsync(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(
            this.visitor.visitQuery(decoded, buildQueryParameterMask(input)),
        );
    }

    encodeFields(input: IFields, options: ParseParameterOptions = {}) {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitFields(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeFields(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFields(decoded));
    }

    encodeField(input: IField) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitField(input));
    }

    encodeFilters(input: IFilters, options: ParseParameterOptions = {}) {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitFilters(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeFilters(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFilters(decoded));
    }

    async encodeFiltersAsync(
        input: IFilters,
        options: ParseParameterOptions = {},
    ) : Promise<string | null> {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitFilters(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = await this.decoder.decodeFiltersAsync(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFilters(decoded));
    }

    encodeFilter(input: IFilter) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFilter(input));
    }

    encodePagination(input: IPagination, options: ParseParameterOptions = {}) {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitPagination(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodePagination(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitPagination(decoded));
    }

    encodeRelations(input: IRelations, options: ParseParameterOptions = {}) {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitRelations(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeRelations(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitRelations(decoded));
    }

    encodeSort(input: ISorts, options: ParseParameterOptions = {}) {
        this.visitor.reset();

        const encoded = this.runSerializer(this.visitor.visitSorts(input));
        if (encoded === null || !isSchemaAware(options)) {
            return encoded;
        }

        const decoded = this.decoder.decodeSort(encoded, options);
        if (!decoded) {
            return null;
        }

        this.visitor.reset();

        return this.runSerializer(this.visitor.visitSorts(decoded));
    }

    /**
     * A visitor reset also happens *before* every encode call —
     * a failed (thrown) encode must not leak state into the next one.
     */
    protected runSerializer<T>(serializer: ISerializer<T>) : T {
        const output = serializer.serialize();
        serializer.reset();

        return output;
    }
}

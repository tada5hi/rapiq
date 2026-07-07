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
} from '@rapiq/core';
import type { IEncoder } from '../types';
import type { ISerializer } from './serializer';
import { QueryVisitor } from './visitors';

export class URLEncoder implements IEncoder<string | null> {
    protected visitor : QueryVisitor;

    constructor() {
        this.visitor = new QueryVisitor();
    }

    encode(input: IQuery): string | null {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitQuery(input));
    }

    encodeFields(input: IFields) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFields(input));
    }

    encodeField(input: IField) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitField(input));
    }

    encodeFilters(input: IFilters) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFilters(input));
    }

    encodeFilter(input: IFilter) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitFilter(input));
    }

    encodePagination(input: IPagination) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitPagination(input));
    }

    encodeRelations(input: IRelations) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitRelations(input));
    }

    encodeSort(input: ISorts) {
        this.visitor.reset();

        return this.runSerializer(this.visitor.visitSorts(input));
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

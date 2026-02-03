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
        return this.runSerializer(this.visitor.visitQuery(input));
    }

    encodeFields(input: IFields) {
        return this.runSerializer(this.visitor.visitFields(input));
    }

    encodeField(input: IField) {
        return this.runSerializer(this.visitor.visitField(input));
    }

    encodeFilters(input: IFilters) {
        return this.runSerializer(this.visitor.visitFilters(input));
    }

    encodeFilter(input: IFilter) {
        return this.runSerializer(this.visitor.visitFilter(input));
    }

    encodePagination(input: IPagination) {
        return this.runSerializer(this.visitor.visitPagination(input));
    }

    encodeRelations(input: IRelations) {
        return this.runSerializer(this.visitor.visitRelations(input));
    }

    encodeSort(input: ISorts) {
        return this.runSerializer(this.visitor.visitSorts(input));
    }

    protected runSerializer<T>(serializer: ISerializer<T>) : T {
        const output = serializer.serialize();
        serializer.reset();

        return output;
    }
}

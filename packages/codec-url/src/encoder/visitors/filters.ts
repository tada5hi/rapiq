/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLFilterOperator } from '@rapiq/parser-simple';
import type { IFilterVisitor, IFiltersVisitor } from '@rapiq/core';
import {
    Filter,
    FilterFieldOperator,
    Filters,
} from '@rapiq/core';

import { URLParameter } from '../../constants';
import { RecordSerializer } from '../serializer';

export class FiltersVisitor implements IFiltersVisitor<RecordSerializer>,
IFilterVisitor<RecordSerializer> {
    protected serializer : RecordSerializer;

    constructor(serializer? : RecordSerializer) {
        this.serializer = serializer || new RecordSerializer(
            URLParameter.FILTERS,
        );
    }

    visitFilters(expr: Filters): RecordSerializer {
        for (let i = 0; i < expr.value.length; i++) {
            const value = expr.value[i];
            if (value instanceof Filters) {
                value.accept(this);
            }

            if (value instanceof Filter) {
                value.accept(this);
            }
        }

        return this.serializer;
    }

    visitFilter(expr: Filter): RecordSerializer {
        const normalized = this.normalizeValue(expr.value);

        if (
            expr.operator === FilterFieldOperator.NOT_EQUAL ||
            expr.operator === FilterFieldOperator.NOT_IN
        ) {
            this.serializer.set(
                expr.field,
                URLFilterOperator.NEGATION + normalized,
            );

            return this.serializer;
        }

        if (expr.operator === FilterFieldOperator.LESS_THAN) {
            this.serializer.set(
                expr.field,
                URLFilterOperator.LESS_THAN + normalized,
            );

            return this.serializer;
        }

        if (expr.operator === FilterFieldOperator.LESS_THAN_EQUAL) {
            this.serializer.set(
                expr.field,
                URLFilterOperator.LESS_THAN_EQUAL + normalized,
            );

            return this.serializer;
        }

        if (expr.operator === FilterFieldOperator.GREATER_THAN) {
            this.serializer.set(
                expr.field,
                URLFilterOperator.GREATER_THAN + normalized,
            );
        }

        if (expr.operator === FilterFieldOperator.GREATER_THAN_EQUAL) {
            this.serializer.set(
                expr.field,
                URLFilterOperator.GREATER_THAN_EQUAL + normalized,
            );
        }

        // todo: like missing

        this.serializer.set(expr.field, normalized);

        return this.serializer;
    }

    protected normalizeValue(input: unknown) : string {
        if (typeof input === 'string') {
            return input;
        }

        if (
            typeof input === 'undefined' ||
            input === 'null' ||
            input === null
        ) {
            return 'null';
        }

        if (typeof input === 'number') {
            return `${input}`;
        }

        if (typeof input === 'boolean') {
            return input ? 'true' : 'false';
        }

        if (input instanceof RegExp) {
            return input.source;
        }

        if (Array.isArray(input)) {
            return input
                .map((el) => this.normalizeValue(el))
                .filter(Boolean)
                .join(',');
        }

        throw new Error('Value can not be normalized');
    }
}

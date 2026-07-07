/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    URLFilterOperator,
    parseFilterWireValue,
    serializeFilterValue,
} from '@rapiq/parser-simple';
import type { IFilterVisitor, IFiltersVisitor } from '@rapiq/core';
import {
    AdapterError,
    Filter,
    FilterCompoundOperator,
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
        // subset law: the simple wire dialect expresses flat root-AND
        // condition sets only — anything else must fail loudly instead
        // of silently flattening into changed semantics.
        if (
            expr.operator === FilterCompoundOperator.OR &&
            expr.value.length > 1
        ) {
            throw AdapterError.featureUnsupported('filters:or');
        }

        for (let i = 0; i < expr.value.length; i++) {
            const value = expr.value[i];
            if (value instanceof Filters) {
                throw AdapterError.featureUnsupported('filters:compound');
            }

            if (value instanceof Filter) {
                value.accept(this);
            }
        }

        return this.serializer;
    }

    visitFilter(expr: Filter): RecordSerializer {
        // the wire record holds one condition per field — a second
        // one would silently overwrite the first (changed semantics).
        if (this.serializer.has(expr.field)) {
            throw AdapterError.featureUnsupported('filters:field:duplicate');
        }

        this.serializer.set(expr.field, this.serializeCondition(expr));

        return this.serializer;
    }

    protected serializeCondition(expr: Filter) : string {
        switch (expr.operator) {
            case FilterFieldOperator.EQUAL:
            case FilterFieldOperator.IN: {
                return this.verifyWireValue(expr, serializeFilterValue(expr.value));
            }
            case FilterFieldOperator.NOT_EQUAL:
            case FilterFieldOperator.NOT_IN: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.NEGATION + serializeFilterValue(expr.value),
                );
            }
            case FilterFieldOperator.LESS_THAN: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.LESS_THAN + serializeFilterValue(expr.value),
                );
            }
            case FilterFieldOperator.LESS_THAN_EQUAL: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.LESS_THAN_EQUAL + serializeFilterValue(expr.value),
                );
            }
            case FilterFieldOperator.GREATER_THAN: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.GREATER_THAN + serializeFilterValue(expr.value),
                );
            }
            case FilterFieldOperator.GREATER_THAN_EQUAL: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.GREATER_THAN_EQUAL + serializeFilterValue(expr.value),
                );
            }
            case FilterFieldOperator.CONTAINS: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.LIKE + this.serializeLikeText(expr) + URLFilterOperator.LIKE,
                );
            }
            case FilterFieldOperator.NOT_CONTAINS: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.NEGATION + URLFilterOperator.LIKE +
                        this.serializeLikeText(expr) + URLFilterOperator.LIKE,
                );
            }
            case FilterFieldOperator.STARTS_WITH: {
                return this.verifyWireValue(
                    expr,
                    this.serializeLikeText(expr) + URLFilterOperator.LIKE,
                );
            }
            case FilterFieldOperator.NOT_STARTS_WITH: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.NEGATION + this.serializeLikeText(expr) + URLFilterOperator.LIKE,
                );
            }
            case FilterFieldOperator.ENDS_WITH: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.LIKE + this.serializeLikeText(expr),
                );
            }
            case FilterFieldOperator.NOT_ENDS_WITH: {
                return this.verifyWireValue(
                    expr,
                    URLFilterOperator.NEGATION + URLFilterOperator.LIKE + this.serializeLikeText(expr),
                );
            }
            default: {
                // REGEX, MOD, EXISTS, ELEM_MATCH, ... have no simple-dialect
                // wire syntax and would decode as plain equality.
                throw AdapterError.operatorUnsupported(expr.operator);
            }
        }
    }

    /**
     * LIKE inner text travels raw (the decoder applies no scalar
     * coercion and no comma-splitting to it) — strings pass through
     * verbatim, everything else uses the scalar wire form.
     */
    protected serializeLikeText(expr: Filter) : string {
        if (typeof expr.value === 'string') {
            if (expr.value.length === 0) {
                // decodes to an empty match text, which the parser drops.
                throw AdapterError.featureUnsupported('filters:value:empty');
            }

            return expr.value;
        }

        return serializeFilterValue(expr.value);
    }

    /**
     * Subset law, enforced pointwise: the wire token must decode back
     * to the operator it was serialized from (values may still change
     * scalar type — that normalization is part of the wire contract).
     * The simple dialect has no escaping, so e.g. an EQUAL on the
     * string 'foo~' would silently decode as STARTS_WITH 'foo'.
     */
    protected verifyWireValue(expr: Filter, wire: string) : string {
        const reparsed = parseFilterWireValue(wire);

        let matches = reparsed.operator === expr.operator;

        if (!matches && expr.operator === FilterFieldOperator.IN) {
            // scalar lists decode as EQUAL and are lifted to IN by the
            // parser when the value is (or splits into) an array.
            matches = reparsed.operator === FilterFieldOperator.EQUAL;
        }

        if (!matches && expr.operator === FilterFieldOperator.NOT_IN) {
            matches = reparsed.operator === FilterFieldOperator.NOT_EQUAL;
        }

        if (!matches) {
            throw AdapterError.featureUnsupported(`filters:value:${expr.field}`);
        }

        return wire;
    }
}

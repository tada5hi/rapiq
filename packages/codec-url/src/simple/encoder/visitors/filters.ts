/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { encodeFilterWireValue } from '@rapiq/parser-simple';
import type { IFilterVisitor, IFiltersVisitor } from '@rapiq/core';
import {
    AdapterError,
    Filter,
    FilterCompoundOperator,
    Filters,
} from '@rapiq/core';

import { URLParameter } from '../../../constants';
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

        // a negated group (or any non-and/or compound) has no simple
        // wire form at all — serializing its children positively would
        // silently drop the negation.
        if (
            expr.operator !== FilterCompoundOperator.AND &&
            expr.operator !== FilterCompoundOperator.OR
        ) {
            throw AdapterError.featureUnsupported(`filters:${expr.operator}`);
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

        // the wire grammar (marker spelling, raw LIKE text, collision
        // verification) is owned by @rapiq/parser-simple — a Filter
        // leaf structurally satisfies the codec's condition input.
        this.serializer.set(expr.field, encodeFilterWireValue(expr));

        return this.serializer;
    }
}

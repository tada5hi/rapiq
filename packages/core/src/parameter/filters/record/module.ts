/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition as BaseFieldCondition } from '@ucast/core';
import { FilterFieldOperator } from '../../../schema';
import type { IFilter, IFilterVisitor } from './types';

export class Filter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> extends BaseFieldCondition<VALUE> implements IFilter<OPERATOR, VALUE> {
    // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-useless-constructor
    constructor(
        operator: OPERATOR,
        key: string,
        value: VALUE,
    ) {
        super(operator, key, value);
    }

    accept<R>(visitor: IFilterVisitor<R>) : R {
        if (this.operator === FilterFieldOperator.EQUAL) {
            return this.acceptWithFallback(visitor, 'visitFilterEqual');
        }

        if (this.operator === FilterFieldOperator.NOT_EQUAL) {
            return this.acceptWithFallback(visitor, 'visitFilterNotEqual');
        }

        if (this.operator === FilterFieldOperator.LESS_THAN) {
            return this.acceptWithFallback(visitor, 'visitFilterLessThan');
        }

        if (this.operator === FilterFieldOperator.LESS_THAN_EQUAL) {
            return this.acceptWithFallback(visitor, 'visitFilterLessThanEqual');
        }

        if (this.operator === FilterFieldOperator.GREATER_THAN) {
            return this.acceptWithFallback(visitor, 'visitFilterGreaterThan');
        }

        if (this.operator === FilterFieldOperator.GREATER_THAN_EQUAL) {
            return this.acceptWithFallback(visitor, 'visitFilterGreaterThanEqual');
        }

        if (this.operator === FilterFieldOperator.EXISTS) {
            return this.acceptWithFallback(visitor, 'visitFilterExists');
        }

        if (this.operator === FilterFieldOperator.IN) {
            return this.acceptWithFallback(visitor, 'visitFilterIn');
        }

        if (this.operator === FilterFieldOperator.NOT_IN) {
            return this.acceptWithFallback(visitor, 'visitFilterNotIn');
        }

        if (this.operator === FilterFieldOperator.MOD) {
            return this.acceptWithFallback(visitor, 'visitFilterMod');
        }

        if (this.operator === FilterFieldOperator.ELEM_MATCH) {
            return this.acceptWithFallback(visitor, 'visitFilterElemMatch');
        }

        if (this.operator === FilterFieldOperator.CONTAINS) {
            return this.acceptWithFallback(visitor, 'visitFilterContains');
        }

        if (this.operator === FilterFieldOperator.NOT_CONTAINS) {
            return this.acceptWithFallback(visitor, 'visitFilterNotContains');
        }

        if (this.operator === FilterFieldOperator.STARTS_WITH) {
            return this.acceptWithFallback(visitor, 'visitFilterStartsWith');
        }

        if (this.operator === FilterFieldOperator.NOT_STARTS_WITH) {
            return this.acceptWithFallback(visitor, 'visitFilterNotStartsWith');
        }

        if (this.operator === FilterFieldOperator.ENDS_WITH) {
            return this.acceptWithFallback(visitor, 'visitFilterEndsWith');
        }

        if (this.operator === FilterFieldOperator.NOT_ENDS_WITH) {
            return this.acceptWithFallback(visitor, 'visitFilterNotEndsWith');
        }

        if (this.operator === FilterFieldOperator.REGEX) {
            return this.acceptWithFallback(visitor, 'visitFilterRegex');
        }

        return visitor.visitFilter(this);
    }

    private acceptWithFallback<R, P extends keyof IFilterVisitor<R>>(
        visitor: IFilterVisitor<R>,
        property: P,
    ) : R {
        if (visitor[property]) {
            return visitor[property](this as Filter<any, any>);
        }

        return visitor.visitFilter(this);
    }
}

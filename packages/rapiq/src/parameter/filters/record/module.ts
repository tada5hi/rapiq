/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition as BaseFieldCondition } from '@ucast/core';
import { FilterFieldOperator } from '../../../schema';
import type { IFilterVisitor } from './types';

export class Filter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> extends BaseFieldCondition<VALUE> {
    public readonly raw: unknown;

    // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-useless-constructor
    constructor(
        operator: OPERATOR,
        key: string,
        value: VALUE,
    ) {
        super(operator, key, value);
    }

    accept<R>(visitor: IFilterVisitor<R>) : R {
        if (
            this.operator === FilterFieldOperator.EQUAL &&
            visitor.visitFilterEqual
        ) {
            return visitor.visitFilterEqual(this);
        }

        if (
            this.operator === FilterFieldOperator.NOT_EQUAL &&
            visitor.visitFilterNotEqual
        ) {
            return visitor.visitFilterNotEqual(this);
        }

        if (
            this.operator === FilterFieldOperator.REGEX &&
            visitor.visitFilterRegex
        ) {
            return visitor.visitFilterRegex(this as Filter<FilterFieldOperator.REGEX, RegExp>);
        }

        return visitor.visitFilter(this);
    }
}

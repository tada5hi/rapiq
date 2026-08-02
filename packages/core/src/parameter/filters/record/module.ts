/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { IFilter, IFilterVisitor } from './types';

export class Filter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> implements IFilter<OPERATOR, VALUE> {
    readonly operator: string;

    readonly value: VALUE;

    readonly field: string;

    constructor(operator: string, field: string, value: VALUE) {
        this.operator = operator;
        this.field = field;
        this.value = value;
    }

    accept<R>(visitor: IFilterVisitor<R>) : R {
        return visitor.visitFilter(this);
    }
}

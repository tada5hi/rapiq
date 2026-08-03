/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import type { ConditionOptions } from '../condition';
import type { IFilter, IFilterVisitor } from './types';

export class Filter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> implements IFilter<OPERATOR, VALUE> {
    readonly operator: string;

    readonly value: VALUE;

    readonly field: string;

    readonly sealed?: boolean;

    constructor(
        operator: string,
        field: string,
        value: VALUE,
        options: ConditionOptions = {},
    ) {
        this.operator = operator;
        this.field = field;
        this.value = value;

        // only set when sealed, so an unsealed condition stays
        // structurally identical to what earlier versions produced.
        if (options.sealed) {
            this.sealed = true;
        }
    }

    accept<R>(visitor: IFilterVisitor<R>) : R {
        return visitor.visitFilter(this);
    }

    seal() : IFilter {
        if (this.sealed) {
            return this;
        }

        return new Filter(this.operator, this.field, this.value, { sealed: true });
    }
}

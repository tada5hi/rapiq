/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterFieldOperator } from '../../../schema';
import { Condition } from '../condition';
import type { BuiltInConditionOptions } from '../condition';
import type { IFilter, IFilterVisitor } from './types';

export class Filter<
    OPERATOR extends string = `${FilterFieldOperator}`,
    VALUE = unknown,
> extends Condition<VALUE> implements IFilter<OPERATOR, VALUE> {
    readonly field: string;

    readonly preserved?: true;

    constructor(
        operator: string,
        field: string,
        value: VALUE,
        options: BuiltInConditionOptions = {},
    ) {
        super(operator, value, options);
        this.field = field;

        if (options.preserved) {
            this.preserved = true;
        }
    }

    accept<R>(visitor: IFilterVisitor<R>) : R {
        return visitor.visitFilter(this);
    }

    seal() : IFilter<OPERATOR, VALUE> {
        if (this.sealed) {
            return this;
        }

        return new Filter<OPERATOR, VALUE>(
            this.operator,
            this.field,
            this.value,
            { preserved: this.preserved, sealed: true },
        );
    }
}

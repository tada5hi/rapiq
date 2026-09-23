/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../call';
import type { AggregateOptions, IAggregate, IAggregateVisitor } from './types';

export class Aggregate implements IAggregate {
    readonly key: string;

    readonly name: string;

    readonly params: readonly string[];

    readonly lowering: CallLowering | undefined;

    constructor(options: AggregateOptions) {
        this.name = options.name;
        this.params = [...(options.params ?? [])];
        this.lowering = options.lowering;

        // a query routinely asks one measure of several columns, so the
        // params join the key in camel case: sum(amount),sum(total_fee)
        // is sumAmount, sumTotalFee.
        this.key = this.name + this.params
            .flatMap((param) => param.split('_'))
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    accept<R>(visitor: IAggregateVisitor<R>) : R {
        return visitor.visitAggregate(this);
    }
}

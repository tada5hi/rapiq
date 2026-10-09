/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../call';

export interface IAggregateVisitor<R> {
    visitAggregate(expr: IAggregate): R;
}

export interface IAggregate {
    /**
     * Output key, the row key and the grouped sort target: the name
     * followed by each param in camel case (`sum(total_amount)` is `sumTotalAmount`).
     */
    readonly key: string;

    /** Callee, as written on the wire. */
    readonly name: string;

    /** Wire arguments as written. */
    readonly params: readonly string[];

    /** undefined = unresolved (a client-built named call); adapters refuse it. */
    readonly lowering: CallLowering | undefined;

    accept<R>(visitor: IAggregateVisitor<R>) : R;
}

export type AggregateOptions = {
    name: string,
    params?: string[],
    lowering?: CallLowering,
};

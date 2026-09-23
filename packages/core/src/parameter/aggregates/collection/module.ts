/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import { MergeError } from '../../../errors';
import { isCallEqual } from '../../call';
import type { IAggregate } from '../record';
import type { IAggregates, IAggregatesVisitor } from './types';

export class Aggregates implements IAggregates {
    readonly value: IAggregate[];

    constructor(value: IAggregate[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IAggregatesVisitor<R>) : R {
        return visitor.visitAggregates(this);
    }

    /**
     * Same rule as {@link Groups.merge}: an empty side yields the other,
     * equal sides yield the receiver, anything else throws.
     */
    merge(other: IAggregates) : IAggregates {
        if (this.value.length === 0) {
            return other;
        }

        if (other.value.length === 0) {
            return this;
        }

        if (
            this.value.length === other.value.length &&
            this.value.every((item, index) => isCallEqual(item, other.value[index]!))
        ) {
            return this;
        }

        throw MergeError.callsConflict(Parameter.AGGREGATES);
    }
}

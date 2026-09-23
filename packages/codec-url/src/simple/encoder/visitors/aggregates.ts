/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IAggregate,
    IAggregateVisitor,
    IAggregates,
    IAggregatesVisitor,
} from '@rapiq/core';

import { URLParameter } from '../../../constants';
import { ArraySerializer } from '../serializer';
import { serializeCallTermStrict } from './calls';

export class AggregatesVisitor implements IAggregatesVisitor<ArraySerializer>,
IAggregateVisitor<ArraySerializer> {
    protected serializer : ArraySerializer;

    constructor(serializer?: ArraySerializer) {
        this.serializer = serializer || new ArraySerializer(
            URLParameter.AGGREGATES,
        );
    }

    visitAggregates(expr: IAggregates): ArraySerializer {
        for (const item of expr.value) {
            item.accept(this);
        }

        return this.serializer;
    }

    visitAggregate(expr: IAggregate): ArraySerializer {
        this.serializer.add(serializeCallTermStrict(expr, 'aggregates:term'));

        return this.serializer;
    }
}

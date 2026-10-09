/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import { BuildError } from '../../../errors';
import type { IAggregate, IAggregates } from '../../../parameter';
import {
    Aggregate,
    Aggregates,
    isAggregate,
    isAggregates,
} from '../../../parameter';
import { isParameterNode } from '../../utils';
import { assertCallKeysUnique, buildCallOptions } from '../call/module';
import type { AggregatesBuildInput } from './types';

export function defineAggregates(input: AggregatesBuildInput) : IAggregates {
    if (isAggregates(input)) {
        return input;
    }

    if (!Array.isArray(input)) {
        throw BuildError.inputInvalid();
    }

    const output : IAggregate[] = input.map((element) => {
        if (isAggregate(element)) {
            return element;
        }

        // a node of another parameter (a Sort, a Group) is no aggregate.
        if (isParameterNode(element)) {
            throw BuildError.inputInvalid();
        }

        return new Aggregate(buildCallOptions(Parameter.AGGREGATES, element));
    });

    assertCallKeysUnique(output.map((item) => item.key));

    return new Aggregates(output);
}

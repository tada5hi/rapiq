/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../../constants';
import {
    CompoundCondition, type Condition, FilterCompoundOperator,
} from '../../../../schema';
import { extendObject, serializeAsURI } from '../../../../utils';
import { BuildFieldsCondition } from './fields';

export class BuildCompoundCondition<
    T extends Condition = Condition,
> extends CompoundCondition<T> {
    flatten() : Record<string, any> {
        if (this.value.length === 1) {
            const [first] = this.value;

            if (
                first instanceof BuildFieldsCondition ||
                first instanceof BuildCompoundCondition
            ) {
                return first.flatten();
            }

            return {} as Record<string, any>;
        }

        const output : Record<string, any> = {};

        let prefix: string | undefined;
        const input = this.flattenConditions(this.value);
        for (let i = 0; i < input.length; i++) {
            const child = input[i];

            if (this.operator === FilterCompoundOperator.OR) {
                prefix = `${i}`;
            }

            if (
                child instanceof BuildFieldsCondition ||
                child instanceof BuildCompoundCondition
            ) {
                extendObject(output, child.flatten(), prefix);
            }
        }

        return output;
    }

    serialize() : string | undefined {
        return serializeAsURI(this.flatten(), { prefixParts: [URLParameter.FILTERS] });
    }
}

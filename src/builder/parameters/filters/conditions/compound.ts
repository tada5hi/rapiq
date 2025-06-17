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
import { extendObject, renameObjectKeys, serializeAsURI } from '../../../../utils';
import { BuildFieldsCondition } from './fields';

export class BuildCompoundCondition<
    T extends Condition = Condition,
> extends CompoundCondition<T> {
    protected transform(input: T, index: number) {
        if (input instanceof BuildFieldsCondition) {
            return renameObjectKeys(
                input.normalize(),
                (key) => `${index}:${key}`,
            );

            return input.normalize();
        }

        if (input instanceof BuildCompoundCondition) {
            return renameObjectKeys(
                input.normalize(),
                (key) => `${index}${key}`,
            );

            return input.normalize();
        }

        return input;
    }

    normalize() : Record<string, any> {
        const input = this.flattenConditions(this.value);

        if (input.length === 1) {
            const [first] = input;

            if (
                first instanceof BuildFieldsCondition ||
                first instanceof BuildCompoundCondition
            ) {
                return this.transform(first, 0);
            }

            return {} as Record<string, any>;
        }

        const output : Record<string, any> = {};

        for (let i = 0; i < input.length; i++) {
            extendObject(
                output,
                this.transform(input[i], i),
            );
        }

        return output;
    }

    serialize() : string | undefined {
        return serializeAsURI(this.normalize(), { prefixParts: [URLParameter.FILTERS] });
    }
}

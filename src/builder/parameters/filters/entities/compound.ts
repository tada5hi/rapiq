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
import { FiltersConditionBuilder } from './fields';
import { extendObject, renameObjectKeys, serializeAsURI } from '../../../../utils';

export class FiltersCompoundConditionBuilder<
    T extends Condition = Condition,
> extends CompoundCondition<T> {
    protected normalizeChild<T extends Condition>(input: T, index: number) {
        if (
            input instanceof FiltersConditionBuilder ||
            input instanceof FiltersCompoundConditionBuilder
        ) {
            let normalized : Record<string, any>;
            if (input instanceof FiltersCompoundConditionBuilder) {
                normalized = input.normalize(false);
            } else {
                normalized = input.normalize();
            }
            if (this.operator === FilterCompoundOperator.AND) {
                return renameObjectKeys(
                    normalized,
                    (key) => `0${key}`,
                );
            }

            return renameObjectKeys(
                normalized,
                (key) => `${index}${key}`,
            );
        }

        return input;
    }

    normalize(isRoot: boolean = true) : Record<string, any> {
        const input = this.flattenConditions(this.value);

        const output : Record<string, any> = {};

        for (let i = 0; i < input.length; i++) {
            extendObject(
                output,
                this.normalizeChild(input[i], i),
            );
        }

        if (isRoot) {
            return renameObjectKeys(
                output,
                (key) => {
                    const match = key.match(/^(\d+)(.*)/);
                    if (match) {
                        if (this.operator === FilterCompoundOperator.AND) {
                            match[1] = match[1].substring(1);
                            if (!match[1]) {
                                return match[2];
                            }
                        }
                        return `${match[1]}:${match[2]}`;
                    }

                    return key;
                },
            );
        }

        return output;
    }

    serialize() : string | undefined {
        return serializeAsURI(this.normalize(), { prefixParts: [URLParameter.FILTERS] });
    }
}

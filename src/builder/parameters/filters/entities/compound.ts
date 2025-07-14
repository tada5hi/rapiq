/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../../constants';
import type { Condition } from '../../../../schema';
import {
    CompoundCondition, FilterCompoundOperator,
} from '../../../../schema';

import type { IBuilder } from '../../../types';
import { FiltersConditionBuilder } from './fields';
import { extendObject, renameObjectKeys, serializeAsURI } from '../../../../utils';

export class FiltersCompoundConditionBuilder<
    T extends Condition = Condition,
> extends CompoundCondition<T> implements IBuilder<T> {
    addRaw(child: T) {
        this.value.push(child);
    }

    mergeWith(builder: FiltersCompoundConditionBuilder<T>) {
        if (this.operator !== builder.operator) {
            throw new SyntaxError(`The operators must be equal (${this.operator} != ${builder.operator})`);
        }

        for (let i = 0; i < builder.value.length; i++) {
            this.value.push(builder.value[i]);
        }
    }

    protected normalizeChild(input: Condition, index: number) {
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
        if (input.length === 1) {
            const first = input[0];

            if (
                first instanceof FiltersConditionBuilder ||
                first instanceof FiltersCompoundConditionBuilder
            ) {
                return first.normalize();
            }
        }

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

    build() : string | undefined {
        const output = this.normalize();
        const keys = Object.keys(output);
        if (keys.length === 0) {
            return undefined;
        }

        return serializeAsURI(output, { prefixParts: [URLParameter.FILTERS] });
    }
}

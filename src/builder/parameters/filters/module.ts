/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import type { Condition } from '../../../schema';
import {
    CompoundCondition,
    FieldCondition,
    FilterCompoundOperator,
    flattenConditions,
} from '../../../schema';
import type { ObjectLiteral } from '../../../types';

import type { IBuilder } from '../../types';
import {
    extendObject, renameObjectKeys, serializeAsURI, toFlatObject,
} from '../../../utils';
import type { FiltersBuildInput } from './types';

export class FiltersBuilder<
    T extends ObjectLiteral = ObjectLiteral,
> extends CompoundCondition implements IBuilder<FiltersBuildInput<T>> {
    addRaw(input: FiltersBuildInput<T>) {
        const object = toFlatObject(input);
        const keys = Object.keys(object);

        for (let i = 0; i < keys.length; i++) {
            const valueNormalized = this.normalizeValue(object[keys[i]]);
            if (typeof valueNormalized !== 'undefined') {
                const field = new FieldCondition<T>(
                    'eq',
                    keys[i],
                    valueNormalized as T[keyof T],
                );

                this.value.push(field);
            }
        }
    }

    mergeWith(builder: FiltersBuilder<T>) {
        if (this.operator !== builder.operator) {
            throw new SyntaxError(`The operators must be equal (${this.operator} != ${builder.operator})`);
        }

        for (let i = 0; i < builder.value.length; i++) {
            this.value.push(builder.value[i]);
        }
    }

    protected normalizeChild(input: Condition, index: number) {
        if (input instanceof FiltersBuilder) {
            const normalized = input.normalize(false);

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

        if (input instanceof FieldCondition) {
            return {
                [input.field]: input.value,
            };
        }

        return input;
    }

    normalize(isRoot: boolean = true) : Record<string, any> {
        const input = flattenConditions(this.value, this.operator);
        if (input.length === 1) {
            const first = input[0];

            if (first instanceof FiltersBuilder) {
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

    protected normalizeValue(input: unknown) : string | undefined {
        if (typeof input === 'string') {
            return input;
        }

        if (
            typeof input === 'undefined' ||
            input === 'null' ||
            input === null
        ) {
            return 'null';
        }

        if (typeof input === 'number') {
            return `${input}`;
        }

        if (typeof input === 'boolean') {
            return input ? 'true' : 'false';
        }

        if (Array.isArray(input)) {
            return input
                .map((el) => this.normalizeValue(el))
                .filter(Boolean)
                .join(',');
        }

        return undefined;
    }
}

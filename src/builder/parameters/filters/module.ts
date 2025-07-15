/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import {
    CompoundCondition,
    FieldCondition,
    FilterCompoundOperator,
    flattenConditions,
} from '../../../schema';
import type { NestedKeys, ObjectLiteral } from '../../../types';

import type { IBuilder } from '../../types';
import {
    extendObject, renameObjectKeys, serializeAsURI, toFlatObject,
} from '../../../utils';
import type { FiltersBuildInput } from './types';

export class FiltersBuilder<
    T extends ObjectLiteral = ObjectLiteral,
> extends CompoundCondition<FiltersBuilder<T> | FieldCondition<string, NestedKeys<T>>> implements IBuilder<FiltersBuildInput<T>> {
    addRaw(input: FiltersBuildInput<T>) {
        const object = toFlatObject(input);

        const keys = Object.keys(object);

        for (let i = 0; i < keys.length; i++) {
            const valueNormalized = this.normalizeValue(object[keys[i]]);
            if (typeof valueNormalized !== 'undefined') {
                const field = new FieldCondition<string, NestedKeys<T>>(
                    'eq',
                    keys[i] as NestedKeys<T>,
                    valueNormalized,
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

    normalize(isRoot: boolean = true) : Record<string, any> {
        const input = flattenConditions(this.value, this.operator);
        if (input.length === 1) {
            const first = input[0];

            if (first instanceof FiltersBuilder) {
                return first.normalize(isRoot);
            }
        }

        const output : Record<string, any> = {};

        for (let i = 0; i < input.length; i++) {
            const item = input[i];

            if (item instanceof FieldCondition) {
                output[item.field] = item.value;
                continue;
            }

            const normalized = item.normalize(false);

            if (this.operator === FilterCompoundOperator.AND) {
                extendObject(
                    output,
                    renameObjectKeys(
                        normalized,
                        (key) => `0${key}`,
                    ),
                );

                continue;
            }

            extendObject(
                output,
                renameObjectKeys(
                    normalized,
                    (key) => `${i}${key}`,
                ),
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

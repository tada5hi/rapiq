/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../../constants';
import { FieldCondition, FieldsCondition } from '../../../../schema';
import type {
    NestedKeys, ObjectLiteral, TypeFromNestedKeyPath,
} from '../../../../types';
import { serializeAsURI, toFlatObject } from '../../../../utils';

import type { IBuilder } from '../../../types';
import type { FiltersBuildInput, FiltersBuildInputValue } from '../types';

export class FiltersConditionBuilder<
    T extends ObjectLiteral = ObjectLiteral,
> extends FieldsCondition<T> implements IBuilder<
FiltersBuildInput<T>
> {
    addRaw(input: FiltersBuildInput<T>) {
        const object = toFlatObject(input);
        const keys = Object.keys(object);

        for (let i = 0; i < keys.length; i++) {
            this.set(
                keys[i] as NestedKeys<T>,
                object[keys[i]] as T[keyof T],
            );
        }
    }

    set<K extends NestedKeys<T>>(key: K, value: FiltersBuildInputValue<TypeFromNestedKeyPath<T, K>>) {
        const valueNormalized = this.normalizeValue(value);
        if (typeof valueNormalized !== 'undefined') {
            const field = new FieldCondition<T>(
                'eq',
                key,
                valueNormalized as T[keyof T],
            );

            this.value.push(field);
        }
    }

    unset(key: NestedKeys<T>) {
        const index = this.value.findIndex((item) => item.field === key);
        if (index !== -1) {
            this.value.splice(index, 1);
        }
    }

    normalize() : Record<string, any> {
        const output = {} as T;

        for (let i = 0; i < this.value.length; i++) {
            output[this.value[i].field as keyof T] = this.value[i].value as T[keyof T];
        }

        return output;
    }

    build() : string | undefined {
        if (this.value.length === 0) {
            return undefined;
        }

        const normalized = this.normalize();
        return serializeAsURI(normalized, { prefixParts: [URLParameter.FILTERS] });
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

/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../../constants';
import { FieldCondition, FieldsCondition } from '../../../../schema';
import type { ObjectLiteral } from '../../../../types';
import { serializeAsURI, toFlatObject } from '../../../../utils';
import type { FiltersBuildInput } from '../types';

export class BuildFieldsCondition<
    T extends ObjectLiteral = ObjectLiteral,
> extends FieldsCondition {
    addRaw(input: FiltersBuildInput<T>) {
        const object = toFlatObject(input);
        const keys = Object.keys(object);

        for (let i = 0; i < keys.length; i++) {
            const value = this.normalizeValue(object[keys[i]]);
            if (typeof value !== 'undefined') {
                const field = new FieldCondition<T>('eq', keys[i], value as T[keyof T]);
                this.value.push(field);
            }
        }
    }

    flatten() {
        const output = {} as T;

        for (let i = 0; i < this.value.length; i++) {
            output[this.value[i].field as keyof T] = this.value[i].value as T[keyof T];
        }

        return output;
    }

    serialize() {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
            return undefined;
        }

        return serializeAsURI(this.flatten(), { prefixParts: [URLParameter.FILTERS] });
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

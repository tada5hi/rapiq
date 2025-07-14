/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import { SortDirection } from '../../../schema';
import type { NestedKeys, ObjectLiteral, SimpleKeys } from '../../../types';
import {
    extendObject, isObject, serializeAsURI, toFlatObject,
} from '../../../utils';

import type { IBuilder } from '../../types';
import type { SortBuildInput } from './types';

export class SortBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<SortBuildInput<RECORD>> {
    public readonly value : Record<string, `${SortDirection}`>;

    constructor() {
        this.value = {};
    }

    clear() {
        const keys = Object.keys(this.value);
        for (let i = 0; i < keys.length; i++) {
            delete this.value[keys[i]];
        }
    }

    addRaw(input: SortBuilder<RECORD> | SortBuildInput<RECORD>) {
        if (input instanceof SortBuilder) {
            this.addRaw(input.value as SortBuildInput<RECORD>);
            return;
        }

        const transformed = this.transformInput(input);

        const record = toFlatObject(transformed);
        const keys = Object.keys(record);
        for (let i = 0; i < keys.length; i++) {
            this.value[keys[i]] = record[keys[i]];
        }
    }

    set(key: SimpleKeys<RECORD> | NestedKeys<RECORD>, value: `${SortDirection}`) {
        this.value[key] = value;
    }

    unset(key: SimpleKeys<RECORD>) {
        delete this.value[key];
    }

    protected transformInput(input: unknown) : Record<string, unknown> {
        if (typeof input === 'undefined' || input === 'null') {
            return {};
        }

        if (typeof input === 'string') {
            return input.split(',')
                .reduce((acc, curr) => {
                    if (curr.startsWith('-')) {
                        acc[curr.slice(1)] = SortDirection.DESC;
                    } else {
                        acc[curr] = SortDirection.ASC;
                    }

                    return acc;
                }, {} as Record<string, SortDirection>);
        }

        if (Array.isArray(input)) {
            const output : Record<string, unknown> = {};
            for (let i = 0; i < input.length; i++) {
                extendObject(output, this.transformInput(input[i]));
            }

            return output;
        }

        if (isObject(input)) {
            const output : Record<string, unknown> = {};
            const keys = Object.keys(input);
            for (let i = 0; i < keys.length; i++) {
                if (Array.isArray(input[keys[i]]) || isObject(input[keys[i]])) {
                    output[keys[i]] = this.transformInput(input[keys[i]]);
                } else {
                    output[keys[i]] = input[keys[i]];
                }
            }

            return output;
        }

        return {};
    }

    serialize() {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
            return undefined;
        }

        const parts : string[] = [];

        for (let i = 0; i < keys.length; i++) {
            parts.push((this.value[keys[i]] === SortDirection.DESC ? '-' : '') + keys[i]);
        }

        return serializeAsURI(parts, { prefixParts: [URLParameter.SORT] });
    }
}

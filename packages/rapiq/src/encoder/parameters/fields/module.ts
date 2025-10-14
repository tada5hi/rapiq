/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { distinctArray } from 'smob';
import { DEFAULT_ID, URLParameter } from '../../../constants';
import type { ObjectLiteral } from '../../../types';
import {
    groupArrayByKeyPath, isObject,
    serializeAsURI, toKeyPathArray,
} from '../../../utils';

import type { IBuilder } from '../../types';
import type { FieldsBuildInput, FieldsBuildTupleInput } from './types';

export class FieldsBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> implements IBuilder<FieldsBuildInput<RECORD>> {
    public readonly value: Record<string, string[]> = {};

    constructor() {
        this.value = {};
    }

    clear() {
        const keys = Object.keys(this.value);
        for (let i = 0; i < keys.length; i++) {
            delete this.value[keys[i]];
        }
    }

    addRaw(input: FieldsBuildInput<RECORD>) {
        if (typeof input === 'string') {
            this.addRaw([input]);
            return;
        }

        if (this.isTupleInput(input)) {
            this.addRaw({
                [DEFAULT_ID]: input[0],
                ...input[1],
            });

            return;
        }

        const normalized = groupArrayByKeyPath(toKeyPathArray(input));
        const keys = Object.keys(normalized);

        for (let i = 0; i < keys.length; i++) {
            if (this.value[keys[i]]) {
                this.value[keys[i]] = distinctArray([
                    ...this.value[keys[i]],
                    ...normalized[keys[i]],
                ]);
            } else {
                this.value[keys[i]] = normalized[keys[i]];
            }
        }
    }

    mergeWith(builder: FieldsBuilder<RECORD>) {
        const keys = Object.keys(builder.value);
        for (let i = 0; i < keys.length; i++) {
            if (this.value[keys[i]]) {
                this.value[keys[i]] = distinctArray([
                    ...this.value[keys[i]],
                    ...builder.value[keys[i]],
                ]);
            } else {
                this.value[keys[i]] = builder.value[keys[i]];
            }
        }
    }

    build(): string | undefined {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
            return undefined;
        }

        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return serializeAsURI(this.value[DEFAULT_ID], { prefixParts: [URLParameter.FIELDS] });
        }

        return serializeAsURI(this.value, { prefixParts: [URLParameter.FIELDS] });
    }

    protected isTupleInput(input: unknown) : input is FieldsBuildTupleInput<RECORD> {
        if (!Array.isArray(input) || input.length !== 2) {
            return false;
        }

        return Array.isArray(input[1]) && isObject(input[2]);
    }
}

/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import { hasOwnProperty, serializeAsURI } from '../../../utils';

import type { IBuilder } from '../../types';
import type { PaginationBuildInput } from './types';

export class PaginationBuilder implements IBuilder<PaginationBuildInput> {
    public readonly value : PaginationBuildInput;

    constructor() {
        this.value = {};
    }

    clear() {
        const keys = Object.keys(this.value);
        for (let i = 0; i < keys.length; i++) {
            delete this.value[keys[i] as keyof PaginationBuildInput];
        }
    }

    addRaw(input: PaginationBuildInput | PaginationBuilder) {
        if (input instanceof PaginationBuilder) {
            if (hasOwnProperty(input.value, 'offset')) {
                this.setOffset(input.value.offset);
            }

            if (hasOwnProperty(input.value, 'limit')) {
                this.setLimit(input.value.limit);
            }

            return;
        }

        if (hasOwnProperty(input, 'offset')) {
            this.setOffset(input.offset);
        }

        if (hasOwnProperty(input, 'limit')) {
            this.setLimit(input.limit);
        }
    }

    setLimit(input?: number) {
        this.value.limit = input;
    }

    setOffset(input?: number) {
        this.value.offset = input;
    }

    serialize() {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
            return undefined;
        }

        return serializeAsURI(this.value, { prefixParts: [URLParameter.PAGINATION] });
    }
}

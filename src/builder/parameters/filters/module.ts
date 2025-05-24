/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import {
    extendObject, isObject, merge, toFlatObject,
} from '../../../utils';
import { BaseBuilder } from '../../base';
import type { FiltersBuildInput } from './types';

export class FiltersBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<FiltersBuildInput<RECORD>> {
    protected items : Record<string, any>;

    constructor() {
        super();

        this.items = {};
    }

    add(input: FiltersBuildInput<RECORD>) {
        const transformed = this.transformInput(input);
        this.items = merge(this.items, toFlatObject(transformed));
    }

    prepare(): unknown {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        return this.items;
    }

    protected transformToString(input: unknown) : string | undefined {
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

        if (Array.isArray(input)) {
            return input
                .map((el) => this.transformToString(el))
                .filter(Boolean)
                .join(',');
        }

        return undefined;
    }

    protected transformInput(input: FiltersBuildInput<any>) {
        if (isObject(input)) {
            const output : Record<string, any> = {};

            const keys = Object.keys(input);
            for (let i = 0; i < keys.length; i++) {
                if (isObject(input[keys[i]])) {
                    extendObject(
                        output,
                        this.transformInput(input[keys[i]]),
                        keys[i],
                    );
                } else {
                    output[keys[i]] = this.transformToString(input[keys[i]]);
                }
            }

            return output;
        }

        return {};
    }
}

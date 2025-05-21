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
        this.items = merge(this.items, this.transformInput(input));
    }

    prepare(): unknown {
        const keys = Object.keys(this.items);
        if (keys.length === 0) {
            return undefined;
        }

        return this.items;
    }

    protected transformInput(input: FiltersBuildInput<any>) {
        return toFlatObject(input, {
            transformer: (input, output, key) => {
                if (typeof input === 'undefined') {
                    output[key] = null;

                    return true;
                }

                if (Array.isArray(input)) {
                    // preserve null values
                    const data : string[] = [];
                    for (let i = 0; i < input.length; i++) {
                        if (input[i] === null) {
                            input[i] = 'null';
                        }

                        if (typeof input[i] === 'number') {
                            input[i] = `${input[i]}`;
                        }

                        if (typeof input[i] === 'string') {
                            data.push(input[i]);
                        }
                    }

                    output[key] = data.join(',');

                    return true;
                }

                if (isObject(input)) {
                    const tmp = this.transformInput(input as FiltersBuildInput<any>);
                    extendObject(output, tmp);
                }

                return undefined;
            },
        });
    }
}

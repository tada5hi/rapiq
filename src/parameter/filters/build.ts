/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge, toFlatObject } from '../../utils';
import type { ObjectLiteral } from '../../type';
import type { FiltersBuildInput } from './type';

export function buildQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    data?: FiltersBuildInput<T>,
) : Record<string, any> {
    if (typeof data === 'undefined') {
        return {};
    }

    return toFlatObject(data, {
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

            return undefined;
        },
    });
}

export function mergeQueryFilters(
    target?: Record<string, any>,
    source?: Record<string, any>,
) : Record<string, any> {
    return merge(target || {}, source || {});
}

/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import { ObjectLiteral } from '../../type';
import { FiltersBuildInput } from './type';
import { flattenNestedObject } from '../../utils';

export function buildQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    data?: FiltersBuildInput<T>,
) : Record<string, any> {
    if (typeof data === 'undefined') {
        return {};
    }

    return flattenNestedObject(data, {
        transformer: (input, output, key) => {
            if (typeof input === 'undefined') {
                output[key] = null;

                return true;
            }

            if (Array.isArray(input)) {
                // todo: check array elements are string
                output[key] = input.join(',');

                return true;
            }

            return undefined;
        },
    });
}

export function mergeQueryFilters<T>(
    target?: Record<string, any>,
    source?: Record<string, any>,
) : Record<string, any> {
    return merge({}, target || {}, source || {});
}

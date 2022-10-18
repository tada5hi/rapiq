/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { mergeArrays } from 'smob';
import { SortBuildInput, SortDirection } from './type';
import { flattenToKeyPathArray } from '../../utils';

export function buildQuerySort<T>(data?: SortBuildInput<T>) {
    if (typeof data === 'undefined') {
        return [];
    }

    if (typeof data === 'string') {
        return [data];
    }

    return flattenToKeyPathArray(data, {
        transformer: ((input, output, path) => {
            if (
                typeof input === 'string' &&
                path &&
                (
                    input === SortDirection.ASC ||
                    input === SortDirection.DESC
                )
            ) {
                if (input === SortDirection.DESC) {
                    output.push(`-${path}`);
                } else {
                    output.push(path);
                }

                return true;
            }

            return undefined;
        }),
    });
}

export function mergeQuerySort<T>(
    target?: string[],
    source?: string[],
) {
    return mergeArrays(target || [], source || [], true);
}

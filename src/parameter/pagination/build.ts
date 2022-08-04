/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { PaginationBuildInput } from './type';
import { mergeDeep } from '../../utils';

export function buildQueryPaginationForMany<T>(
    inputs: PaginationBuildInput<T>[],
) : PaginationBuildInput<T> {
    const inputSources = Array.isArray(inputs) ? inputs : [inputs];

    let data : PaginationBuildInput<T>;
    for (let i = 0; i < inputSources.length; i++) {
        if (data) {
            data = mergeDeep(data, inputSources[i]);
        } else {
            data = inputSources[i];
        }
    }

    return data;
}

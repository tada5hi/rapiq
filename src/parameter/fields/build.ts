/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldsBuildInput } from './type';
import { flattenNestedObject, mergeDeep } from '../../utils';

export function buildQueryFieldsForMany<T>(
    inputs: FieldsBuildInput<T>[],
): Record<string, any> | string | string[] {
    let data: FieldsBuildInput<T>;

    for (let i = 0; i < inputs.length; i++) {
        if (data) {
            const current = inputs[i];
            if (typeof data === 'string' || typeof current === 'string') {
                data = inputs[i];
            } else {
                data = mergeDeep(data, current);
            }
        } else {
            data = inputs[i];
        }
    }

    return buildQueryFields(data);
}

export function buildQueryFields<T>(
    data: FieldsBuildInput<T>,
): Record<string, any> | string | string[] {
    switch (true) {
        case typeof data === 'string':
            return data;
        case Array.isArray(data):
            return data;
        default:
            return flattenNestedObject(data as Record<string, any>);
    }
}

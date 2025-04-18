/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';

export function buildQueryParameterOptions<T extends Record<string, any>>(
    input?: T | boolean,
) : T {
    if (isObject(input)) {
        return input;
    }

    return {} as T;
}

type QueryParameterEnabledContext = {
    data: unknown,
    options?: Record<string, any> | boolean
};
export function isQueryParameterEnabled(context: QueryParameterEnabledContext) : boolean {
    if (typeof context.options === 'boolean') {
        return context.options;
    }

    if (
        typeof context.data !== 'undefined' &&
        typeof context.options === 'undefined'
    ) {
        return true;
    }

    if (isObject(context.options)) {
        if (typeof context.options.default !== 'undefined') {
            return true;
        }

        return typeof context.data !== 'undefined';
    }

    return false;
}

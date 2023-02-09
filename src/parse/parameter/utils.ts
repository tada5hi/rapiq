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

export function isQueryParameterEnabled<T extends Record<string, any>>(
    input?: T | boolean,
) : boolean {
    if (typeof input === 'boolean') {
        return input;
    }

    return true;
}

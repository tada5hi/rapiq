/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RootAliasFn } from '../types';

export function toRootAliasFn<
    QUERY extends Record<string, any> = Record<string, any>,
>(input: string | RootAliasFn<QUERY>) : RootAliasFn<QUERY> {
    if (typeof input === 'function') {
        return input;
    }

    return () => input;
}

export function isRootAliasFn(input: string | RootAliasFn) : input is RootAliasFn {
    return typeof input === 'function';
}

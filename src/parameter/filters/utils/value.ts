/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FilterValueSimple } from '../type';

export function transformFilterValue<T>(input: FilterValueSimple) : FilterValueSimple {
    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            input[i] = transformFilterValue(input[i]) as string | number | boolean;
        }

        return (input as unknown[])
            .filter((n) => n === 0 || !!n) as FilterValueSimple;
    }

    if (typeof input === 'undefined' || input === null) {
        return null;
    }

    if (typeof input === 'string') {
        const lower = input.trim().toLowerCase();

        if (lower === 'true') {
            return true;
        }

        if (lower === 'false') {
            return false;
        }

        if (lower === 'null') {
            return null;
        }

        const num = Number(input);
        if (!Number.isNaN(num)) {
            return num;
        }
    }

    return input;
}

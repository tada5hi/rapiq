/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FilterValueSimple } from '../types';

export function transformFilterValue(input: FilterValueSimple) : FilterValueSimple {
    if (typeof input === 'string') {
        input = input.trim();
        const lower = input.toLowerCase();

        if (lower === 'true') {
            return true;
        }

        if (lower === 'false') {
            return false;
        }

        if (lower === 'null') {
            return null;
        }

        if (input.length === 0) {
            return input;
        }

        const num = Number(input);
        if (!Number.isNaN(num)) {
            return num;
        }

        const parts = input.split(',');
        if (parts.length > 1) {
            return transformFilterValue(parts);
        }
    }

    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            input[i] = transformFilterValue(input[i]) as string | number;
        }

        return (input as unknown[])
            .filter((n) => n === 0 || n === null || !!n) as FilterValueSimple;
    }

    if (typeof input === 'undefined' || input === null) {
        return null;
    }

    return input;
}

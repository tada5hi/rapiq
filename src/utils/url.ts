/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';

type Options = {
    withoutQuestionMark?: boolean,
    prefixParts?: string[]
};

function buildKey(parts: string[]) {
    return parts.reduce((acc, curr) => `${acc}[${curr}]`, '');
}

export function serializeAsURI(data: unknown, options: Options = {}) : string {
    const prefixParts = options.prefixParts || [];

    // Create a query array to hold the key/value pairs
    const query: string[] = [];

    if (Array.isArray(data)) {
        if (prefixParts.length === 0) {
            return '';
        }

        const key = buildKey(prefixParts);
        const serialized = data
            .map((el) => `${el}`)
            .filter(Boolean)
            .join(',');

        query.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);
    }

    if (isObject(data)) {
        // Loop through the data object
        const keys = Object.keys(data);
        if (keys.length === 0) {
            return '';
        }

        for (let i = 0; i < keys.length; i++) {
            let value = data[keys[i]];

            if (isObject(value)) {
                query.push(serializeAsURI(value, {
                    ...options,
                    prefixParts: [...prefixParts, keys[i]],
                }));

                continue;
            }

            if (Array.isArray(value)) {
                query.push(serializeAsURI(value, {
                    ...options,
                    prefixParts: [...prefixParts, keys[i]],
                }));

                continue;
            }

            if (value === null || typeof value === 'undefined') {
                value = 'null';
            }

            if (value) {
                const destinationKey = buildKey([...prefixParts, keys[i]]);
                // Encode each key and value, concatenate them into a string, and push them to the array
                query.push(`${encodeURIComponent(destinationKey)}=${encodeURIComponent(value)}`);
            }
        }
    }

    return query.join('&');
}

export function buildURLQueryString(data?: string | Record<string, any>, options: Options = {}) {
    if (typeof data === 'undefined' || data === null) return '';

    // If the data is already a string, return it as-is
    if (typeof data === 'string') return data;

    const output = serializeAsURI(data);
    if (output.length === 0) {
        return '';
    }

    // Join each item in the array with a `&` and return the resulting string
    return (options.withoutQuestionMark ? '' : '?') + output;
}

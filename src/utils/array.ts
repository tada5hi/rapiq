/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../constants';

export function buildKeyPath(key: string, prefix?: string) {
    if (typeof prefix === 'string') {
        return `${prefix}.${key}`;
    }

    return key;
}

export function flattenToKeyPathArray(
    items: unknown,
    prefix?: string,
): string[] {
    const output: string[] = [];

    if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
            if (Array.isArray(items[i])) {
                for (let j = 0; j < items[i].length; j++) {
                    const key = buildKeyPath(items[i][j], prefix);
                    output.push(key);
                }

                continue;
            }

            if (typeof items[i] === 'string') {
                output.push(buildKeyPath(items[i], prefix));

                continue;
            }

            if (typeof items[i] === 'object') {
                const keys = Object.keys(items[i]);
                for (let j = 0; j < keys.length; j++) {
                    const value = buildKeyPath(keys[j] as string, prefix);
                    output.push(...flattenToKeyPathArray(items[i][keys[j]], value));
                }
            }
        }

        return output;
    }

    if (
        typeof items === 'object' &&
        items
    ) {
        const keys = Object.keys(items);
        for (let i = 0; i < keys.length; i++) {
            const value = buildKeyPath(keys[i], prefix);
            output.push(...flattenToKeyPathArray((items as Record<string, any>)[keys[i]], value));
        }
    }

    return output;
}

export function groupArrayByKeyPath(input: string[]): Record<string, string[]> {
    const pathItems: Record<string, string[]> = {};

    for (let i = 0; i < input.length; i++) {
        const parts = input[i].split('.');

        let key: string;
        let name: string;
        if (parts.length === 1) {
            key = DEFAULT_ID;
            name = input[i];
        } else {
            name = parts.pop();
            key = parts.join('.');
        }

        if (!Object.prototype.hasOwnProperty.call(pathItems, key)) {
            pathItems[key] = [];
        }

        pathItems[key].push(name);
    }

    return pathItems;
}

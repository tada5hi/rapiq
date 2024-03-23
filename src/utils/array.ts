/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../constants';
import { isObject } from './object';

export function buildKeyPath(key: string, prefix?: string) {
    if (typeof prefix === 'string') {
        return `${prefix}.${key}`;
    }

    return key;
}

type Options = {
    transformer?: (
        input: unknown,
        output: string[],
        prefix?: string
    ) => boolean | undefined
};

export function toKeyPathArray(
    input: unknown,
    options?: Options,
    prefix?: string,
): string[] {
    options = options || {};

    const output: string[] = [];

    if (options.transformer) {
        const result = options.transformer(input, output, prefix);
        if (result) {
            return output;
        }
    }

    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            if (options.transformer) {
                const result = options.transformer(input[i], output, prefix);
                if (result) {
                    return output;
                }
            }

            if (Array.isArray(input[i])) {
                for (let j = 0; j < input[i].length; j++) {
                    const key = buildKeyPath(input[i][j], prefix);
                    output.push(key);
                }

                continue;
            }

            if (typeof input[i] === 'string') {
                output.push(buildKeyPath(input[i], prefix));

                continue;
            }

            if (isObject(input[i])) {
                const keys = Object.keys(input[i]);
                for (let j = 0; j < keys.length; j++) {
                    const value = buildKeyPath(keys[j] as string, prefix);
                    const data = toKeyPathArray(input[i][keys[j]], options, value);
                    if (data.length === 0) {
                        output.push(value);
                    } else {
                        output.push(...data);
                    }
                }
            }
        }

        return output;
    }

    if (isObject(input)) {
        const keys = Object.keys(input);
        for (let i = 0; i < keys.length; i++) {
            const value = buildKeyPath(keys[i], prefix);
            const data = toKeyPathArray(input[keys[i]], options, value);
            if (data.length === 0) {
                output.push(value);
            } else {
                output.push(...data);
            }
        }

        return output;
    }

    if (typeof input === 'string') {
        const value = buildKeyPath(input, prefix);
        output.push(value);

        return output;
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
            name = parts.pop() as string;
            key = parts.join('.');
        }

        if (!Object.prototype.hasOwnProperty.call(pathItems, key)) {
            pathItems[key] = [];
        }

        pathItems[key].push(name);
    }

    return pathItems;
}

/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '../constants';
import { isObject } from './object';

export function diffArray<T = unknown>(target: T[], src: T[]): T[] {
    return target.filter((el) => !src.includes(el));
}

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
        prefix?: string,
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
        for (const element of input) {
            if (options.transformer) {
                const result = options.transformer(element, output, prefix);
                if (result) {
                    return output;
                }
            }

            if (Array.isArray(element)) {
                for (const element_ of element) {
                    const key = buildKeyPath(element_, prefix);
                    output.push(key);
                }

                continue;
            }

            if (typeof element === 'string') {
                output.push(buildKeyPath(element, prefix));

                continue;
            }

            if (isObject(element)) {
                const keys = Object.keys(element);
                for (const key of keys) {
                    const value = buildKeyPath(key as string, prefix);
                    const data = toKeyPathArray(element[key], options, value);
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
        for (const key of keys) {
            const value = buildKeyPath(key, prefix);
            const data = toKeyPathArray(input[key], options, value);
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

export function groupArrayByKeyPath(
    input: string[],
): Record<string, string[]> {
    const output: Record<string, string[]> = {};

    for (const element of input) {
        let key: string;
        let name: string;

        const lastIndex = element.lastIndexOf('.');
        if (lastIndex === -1) {
            key = DEFAULT_ID;
            name = element;
        } else {
            key = element.substring(0, lastIndex);
            name = element.substring(lastIndex + 1);
        }

        const list = output[key] ?? [];
        output[key] = list;
        list.push(name);
    }

    return output;
}

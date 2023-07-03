/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function isObject(item: unknown) : item is Record<string, any> {
    return (
        !!item &&
        typeof item === 'object' &&
        !Array.isArray(item)
    );
}
export function hasOwnProperty<
    X extends Record<string, any>,
    Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

type Options = {
    transformer?: (
        input: unknown,
        output: Record<string, any>,
        key: string
    ) => boolean | undefined
};

export function flattenNestedObject(
    data: Record<string, any>,
    options?: Options,
    prefixParts?: string[],
): Record<string, any> {
    options = options || {};
    prefixParts = prefixParts || [];

    let output: Record<string, string> = {};

    if (options.transformer) {
        const result = options.transformer(data, output, prefixParts.join('.'));
        if (typeof result !== 'undefined' && !!result) {
            return output;
        }
    }

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (options.transformer) {
            const result = options.transformer(data[key], output, [...prefixParts, key].join('.'));
            if (typeof result !== 'undefined' && !!result) {
                continue;
            }
        }

        if (
            typeof data[key] === 'object' &&
            data[key]
        ) {
            output = { ...output, ...flattenNestedObject(data[key], options, [...prefixParts, key]) };

            continue;
        }

        const destinationKey = [...prefixParts, key].join('.');

        if (
            typeof data[key] === 'boolean' ||
            typeof data[key] === 'string' ||
            typeof data[key] === 'number' ||
            typeof data[key] === 'undefined' ||
            data[key] === null ||
            Array.isArray(data[key])
        ) {
            output[destinationKey] = data[key];
        }
    }

    return output;
}

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

export function extendObject(target: Record<string, any>, source: Record<string, any>) {
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
        target[keys[i]] = source[keys[i]];
    }

    return target;
}

export function hasOwnProperty<
    X extends Record<string, any>,
    Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function isPropertySet<X extends Record<string, any>, K extends keyof X>(
    obj: X,
    prop: K,
) : boolean {
    return hasOwnProperty(obj, prop);
}

type Options = {
    transformer?: (
        input: unknown,
        output: Record<string, any>,
        key: string
    ) => boolean | undefined,
    validator?: (
        input: unknown,
        key: string
    ) => boolean | undefined,
    prefixParts?: string[]
};

export function toFlatObject(
    data: Record<string, any>,
    options: Options = {},
): Record<string, any> {
    const prefixParts = options.prefixParts || [];
    let output: Record<string, string> = {};

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (isObject(data[key])) {
            output = {
                ...output,
                ...toFlatObject(data[key], {
                    ...options,
                    prefixParts: [...prefixParts, key],
                }),
            };

            continue;
        }

        const destinationKey = [...prefixParts, key].join('.');

        if (options.transformer) {
            const result = options.transformer(data[key], output, destinationKey);
            if (result) {
                continue;
            }
        }

        if (options.validator) {
            const result = options.validator(data[key], destinationKey);
            if (!result) {
                continue;
            }
        }

        output[destinationKey] = data[key];
    }

    return output;
}

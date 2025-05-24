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

export function extendObject(
    target: Record<string, any>,
    source: Record<string, any>,
    prefix?: string,
) {
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
        let destinationKey : string;
        if (prefix) {
            destinationKey = `${prefix}.${keys[i]}`;
        } else {
            destinationKey = keys[i];
        }

        target[destinationKey] = source[keys[i]];
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
    transformer?: (input: unknown, key: string) => unknown | undefined,
    validator?: (input: unknown, key: string) => boolean | undefined,
};

export function toFlatObject(
    data: Record<string, any>,
    options: Options = {},
): Record<string, any> {
    const output: Record<string, string> = {};

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (isObject(data[key])) {
            extendObject(
                output,
                toFlatObject(data[key], options),
                key,
            );

            continue;
        }

        if (options.transformer) {
            data[key] = options.transformer(data[key], key);

            if (isObject(data[key])) {
                extendObject(
                    output,
                    toFlatObject(data[key], options),
                    key,
                );

                continue;
            }
        }

        if (options.validator) {
            const result = options.validator(data[key], key);
            if (!result) {
                continue;
            }
        }

        output[key] = data[key];
    }

    return output;
}

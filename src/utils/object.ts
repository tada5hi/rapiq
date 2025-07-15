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

export function renameObjectKeys(
    target: Record<string, any>,
    fn: (key: string) => string,
) {
    const output : Record<string, any> = {};

    const keys = Object.keys(target);
    for (let i = 0; i < keys.length; i++) {
        const nextKey = fn(keys[i]);
        output[nextKey] = target[keys[i]];
    }

    return output;
}

export function reduceObject(
    target: Record<string, any>,
    fn: (key: string) => boolean,
) {
    const output : Record<string, any> = {};

    const keys = Object.keys(target);
    for (let i = 0; i < keys.length; i++) {
        const remove = fn(keys[i]);
        if (!remove) {
            output[keys[i]] = target[keys[i]];
        }
    }

    return output;
}

export function extendObject(
    target: Record<string, any>,
    source: Record<string, any>,
    prefix?: string,
) {
    let destinationKey : string;

    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
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

        if (options.transformer) {
            data[key] = options.transformer(data[key], key);
        }

        if (options.validator) {
            const result = options.validator(data[key], key);
            if (!result) {
                continue;
            }
        }

        if (isObject(data[key])) {
            console.log(Object.getPrototypeOf(data[key]), data[key]);

            extendObject(
                output,
                toFlatObject(data[key], options),
                key,
            );
        } else {
            output[key] = data[key];
        }
    }

    return output;
}

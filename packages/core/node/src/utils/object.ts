/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Check whether the input is a plain (non-array) object.
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
    Y extends PropertyKey,
>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Check whether an own property is set on the given object.
 */
export function isPropertySet<X extends Record<string, any>, K extends keyof X>(
    obj: X,
    prop: K,
) : boolean {
    return hasOwnProperty(obj, prop);
}

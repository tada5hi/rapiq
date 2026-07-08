/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject, isPropertySet } from '@rapiq/core';
import { isEqual } from 'smob';

/**
 * SQL knows a single absent value; unify undefined and null to null
 * so every downstream test only reasons about null.
 */
export function normalizeValue(input: unknown) : unknown {
    return input === undefined ? null : input;
}

/**
 * Deep value equality after null-unification. `smob`'s `isEqual`
 * covers primitives, `Date` (by time) and structural object/array
 * equality — so an object- or array-valued field is compared by
 * value rather than by reference.
 */
export function isValueEqual(a: unknown, b: unknown) : boolean {
    return isEqual(normalizeValue(a), normalizeValue(b));
}

/**
 * Compare two values of the same comparable type
 * (number, string, boolean, Date); undefined marks
 * the pair as incomparable.
 */
export function compareValues(a: unknown, b: unknown) : number | undefined {
    const bothDates = a instanceof Date && b instanceof Date;
    const left = bothDates ? (a as Date).getTime() : a;
    const right = bothDates ? (b as Date).getTime() : b;

    if (typeof left === 'number' && typeof right === 'number') {
        if (Number.isNaN(left) || Number.isNaN(right)) {
            return undefined;
        }

        if (left === right) {
            return 0;
        }

        return left < right ? -1 : 1;
    }

    if (
        (typeof left === 'string' && typeof right === 'string') ||
        (typeof left === 'boolean' && typeof right === 'boolean')
    ) {
        if (left === right) {
            return 0;
        }

        return left < right ? -1 : 1;
    }

    return undefined;
}

/**
 * The textual form of a value for string matching
 * (contains/startsWith/endsWith/regex); undefined
 * marks the value as non-textual.
 */
export function toText(input: unknown) : string | undefined {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
        return `${input}`;
    }

    return undefined;
}

/**
 * Read an own property off a record-like parent; anything else
 * (null, scalars, arrays, inherited properties) resolves to the
 * absent value.
 */
export function resolveProperty(parent: unknown, name: string) : unknown {
    if (!isObject(parent) || !isPropertySet(parent, name)) {
        return null;
    }

    return normalizeValue(parent[name]);
}

/**
 * Resolve a dotted path by plain object traversal;
 * arrays on the path resolve to the absent value.
 */
export function resolvePath(input: unknown, path: string) : unknown {
    if (!path.includes('.')) {
        return resolveProperty(input, path);
    }

    const segments = path.split('.');

    let current : unknown = input;
    for (const segment of segments) {
        current = resolveProperty(current, segment as string);
    }

    return current;
}

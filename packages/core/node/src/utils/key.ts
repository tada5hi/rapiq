/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { pathToArray } from 'pathtrace';

export type KeyDetails = {
    name: string,
    group?: string,
    path?: string
};

const KEY_REGEX = /^(?:([0-9]+):)?((?:[a-zA-Z0-9-_]+\.)*)([a-zA-Z0-9-_]+)$/;

/**
 * Path segments that address an inherited `Object.prototype` member.
 * They match the permitted key pattern, so they have to be rejected
 * by name: a parser accumulates client-controlled path prefixes into
 * plain objects, and writing through one of these mutates the
 * prototype (or trips over an inherited member) instead of setting
 * a field.
 */
const UNSAFE_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check whether any segment of a (dotted) key path addresses an
 * inherited prototype member.
 */
export function isUnsafeKey(input: string) : boolean {
    // the key grammar allows a leading numeric group ("0:items.title"),
    // so it is stripped before the segments are checked: without this
    // "0:__proto__.x" reads as a segment named "0:__proto__" and slips
    // through.
    const separatorIndex = input.indexOf(':');
    const path = separatorIndex === -1 ?
        input :
        input.substring(separatorIndex + 1);

    if (!path.includes('.')) {
        return UNSAFE_KEY_SEGMENTS.has(path);
    }

    for (const segment of path.split('.')) {
        if (UNSAFE_KEY_SEGMENTS.has(segment)) {
            return true;
        }
    }

    return false;
}

/**
 * Parse a raw key ("[group:][path.]name", e.g. "0:items.title")
 * into its group, relation path and leaf name.
 */
export function parseKey(
    input: string,
) : KeyDetails {
    const matches = KEY_REGEX.exec(input);
    if (!matches) {
        return { name: input };
    }

    const [, group, path, key] = matches;

    return {
        group,
        path: (path && path.at(-1) === '.' ? path.substring(0, path.length - 1) : path),
        name: key ?? input,
    };
}

/**
 * Serialize key details back into the "[group:][path.]name" form.
 */
export function stringifyKey(
    key: KeyDetails,
) : string {
    return `${key.group ? `${key.group}:` : ''}${key.path ? `${key.path}.` : ''}${key.name}`;
}

/**
 * The canonical segments of a dotted key, as an {@link Issue} records them.
 *
 * `pathToArray` rather than `split('.')`, so a key whose segment carries an
 * escaped dot is not torn in half, and bracket indices survive. Segments are
 * stringified: an issue path is what a client reads back, not an accessor.
 */
export function toIssuePath(input: string) : string[] {
    return pathToArray(input).map((segment) => String(segment));
}

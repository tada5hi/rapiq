/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type KeyDetails = {
    name: string,
    group?: string,
    path?: string
};

export const KEY_REGEX = /^(?:([0-9]+):)?((?:[a-zA-Z0-9-_]+\.)*)([a-zA-Z0-9-_]+)$/;

export function parseKey(
    input: string,
) : KeyDetails {
    const matches = KEY_REGEX.exec(input);
    if (!matches) {
        return {
            name: input,
        };
    }

    const [, group, path, key] = matches;

    return {
        group,
        path: (path && path.at(-1) === '.' ? path.substring(0, path.length - 1) : path),
        name: key,
    };
}

export function stringifyKey(
    key: KeyDetails,
) : string {
    return `${key.group ? `${key.group}:` : ''}${key.path ? `${key.path}.` : ''}${key.name}`;
}

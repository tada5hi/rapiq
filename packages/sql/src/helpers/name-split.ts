/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function splitFirst(input: string) : [string, string | undefined] {
    const separatorIndex = input.indexOf('.');

    if (separatorIndex === -1) {
        return [input, ''];
    }

    return [
        input.substring(0, separatorIndex),
        input.substring(separatorIndex + 1),
    ];
}

export function splitLast(input: string) : [string, string | undefined] {
    const separatorIndex = input.lastIndexOf('.');

    if (separatorIndex === -1) {
        return [input, ''];
    }

    return [
        input.substring(0, separatorIndex),
        input.substring(separatorIndex + 1),
    ];
}

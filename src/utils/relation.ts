/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function isPathAllowed(
    path: string,
    allowed?: string[],
) : boolean {
    if (typeof allowed === 'undefined') {
        return true;
    }

    return allowed.some(
        (include) => include === path,
    );
}

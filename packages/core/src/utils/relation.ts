/*
 * Copyright (c) 2021-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Relations } from '../parameter';

export function isPathAllowed(
    path: string,
    allowed?: Relations | string[],
) : boolean {
    if (typeof allowed === 'undefined') {
        return true;
    }

    if (Array.isArray(allowed)) {
        return allowed.some(
            (include) => include === path,
        );
    }

    return allowed.value.some((include) => include.name === path);
}

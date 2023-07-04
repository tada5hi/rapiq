/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { KeyDetails } from './type';

export function parseKey(
    field: string,
) : KeyDetails {
    const parts : string[] = field.split('.');

    const name = parts.pop() as string;

    return {
        name,
        path: parts.length > 0 ? parts.join('.') : undefined,
    };
}

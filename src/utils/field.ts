/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { FieldDetails } from './type';

export function getFieldDetails(field: string) : FieldDetails {
    const parts : string[] = field.split('.');

    return {
        name: parts.pop() as string,
        path: parts.length > 0 ? parts.join('.') : undefined,
    };
}

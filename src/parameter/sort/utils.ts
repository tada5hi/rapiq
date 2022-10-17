/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SortDirection } from './type';

export function parseSortValue(value: string) : {value: string, direction: `${SortDirection}`} {
    let direction: SortDirection = SortDirection.ASC;
    if (value.substring(0, 1) === '-') {
        direction = SortDirection.DESC;
        value = value.substring(1);
    }

    return {
        direction,
        value,
    };
}

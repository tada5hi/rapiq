/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Sort } from './sort';

export class Sorts {
    readonly value: Sort[];

    constructor(value: Sort[] = []) {
        this.value = value;
    }
}

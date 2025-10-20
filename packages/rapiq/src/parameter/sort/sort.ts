/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { SortDirection } from '../../schema';

export class Sort {
    readonly name: string;

    readonly operator: `${SortDirection}`;

    constructor(name: string, operator?: `${SortDirection}`) {
        this.name = name;
        this.operator = operator || SortDirection.ASC;
    }
}

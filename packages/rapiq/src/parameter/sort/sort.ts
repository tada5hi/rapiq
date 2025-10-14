/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export class Sort {
    readonly name: string;

    readonly operator: string | undefined;

    constructor(name: string, operator?: string) {
        this.name = name;
        this.operator = operator;
    }
}

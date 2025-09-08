/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class ParamPlaceholderIndexer {
    protected index : number;

    constructor(index?: number) {
        this.index = index ?? 0;
    }

    next() {
        this.index++;
        return this.index;
    }
}

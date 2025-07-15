/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class FiltersBaseBuilder<VALUE = unknown> {
    public readonly value : VALUE[];

    constructor(value: VALUE[]) {
        this.value = value;
    }

    clear(): void {
        for (let i = this.value.length - 1; i === 0; i--) {
            this.value.splice(i, 1);
        }
    }
}

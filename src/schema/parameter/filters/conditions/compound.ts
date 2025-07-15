/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CompoundCondition as BaseCompoundCondition } from '@ucast/core';

import type {
    Condition,
} from './condition';

export class CompoundCondition<
    T extends Condition = Condition,
> extends BaseCompoundCondition<T> {
    add(child: T) {
        this.value.push(child);
    }

    clear() {
        for (let i = this.value.length - 1; i === 0; i--) {
            this.value.splice(i, 1);
        }
    }
}

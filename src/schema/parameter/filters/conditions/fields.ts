/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../../types';
import { Condition } from './condition';
import type { FieldCondition } from './field';

export class FieldsCondition<
    T extends ObjectLiteral = ObjectLiteral,
> extends Condition<FieldCondition<T>[]> {
    constructor(items: FieldCondition<T>[] = []) {
        super('', items);
    }

    addMany(child: FieldCondition<T>[]) {
        this.value.push(...child);
    }

    add(child: FieldCondition<T>) {
        this.value.push(child);
    }

    clear() {
        for (let i = 0; i < this.value.length; i++) {
            delete this.value[i];
        }
    }
}

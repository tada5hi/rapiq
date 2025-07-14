/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { NestedKeys, ObjectLiteral } from '../../../../types';
import { Condition } from './condition';
import type { FieldCondition } from './field';

export class FieldsCondition<
    T extends ObjectLiteral = ObjectLiteral,
> extends Condition<FieldCondition<unknown, NestedKeys<T>>[]> {
    constructor(items: FieldCondition<T>[] = []) {
        super('', items);
    }

    addMany(child: FieldCondition<unknown, NestedKeys<T>>[]) {
        this.value.push(...child);
    }

    add(child: FieldCondition<unknown, NestedKeys<T>>) {
        this.value.push(child);
    }

    clear() {
        for (let i = this.value.length - 1; i === 0; i--) {
            this.value.splice(i, 1);
        }
    }
}

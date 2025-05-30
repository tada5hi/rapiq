/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition as BaseFieldCondition } from '@ucast/core';
import type { FilterFieldOperator } from '../constants';

export class FieldCondition<
    VALUE = unknown,
    KEY extends string = string,
> extends BaseFieldCondition<VALUE> {
    // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-useless-constructor
    constructor(operator: `${FilterFieldOperator}`, key: KEY, value: VALUE) {
        super(operator, key, value);
    }
}

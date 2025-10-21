/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition as BaseFieldCondition } from '@ucast/core';
import type { FilterFieldOperator } from '../../../schema';

export class Filter<
    VALUE = unknown,
    KEY extends string = string,
> extends BaseFieldCondition<VALUE> {
    public readonly raw: unknown;

    // eslint-disable-next-line no-useless-constructor,@typescript-eslint/no-useless-constructor
    constructor(
        operator: `${FilterFieldOperator}`,
        key: KEY,
        value: VALUE,
    ) {
        super(operator, key, value);
    }
}

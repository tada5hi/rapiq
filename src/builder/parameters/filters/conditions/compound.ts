/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../../types';
import type { FiltersBuildInput } from '../types';

export class FilterBuildCompound<T extends ObjectLiteral> {
    public readonly operator: string;

    public readonly value: FiltersBuildInput<T>[];

    constructor(
        operator: string,
        items: FiltersBuildInput<T>[],
    ) {
        this.operator = operator;
        this.value = items;
    }
}
